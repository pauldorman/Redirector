//// $Id$

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://redirector-modules/utils.js");
Components.utils.import("resource://redirector-modules/redirectorprefs.js");
Components.utils.import("resource://redirector-modules/redirect.js");


//// $Id$


function Redirector() {
	this._init();
}
Redirector.instance = null; //Here we'll keep the singleton instance

Redirector.prototype = {
	
	//rdIRedirector implementation
	get enabled() {
		return this._prefs && this._prefs.enabled;	
	},
	
	set enabled(value) {
		if (this._prefs) {
			this._prefs.enabled = value;
		}
	},

	get redirectCount() {
		return this._list.length;
	},
	
	addRedirect : function(redirect) {
		//This runaround is necessary because the redirect
		//that was created somewhere up in the GUI doesn't
		//have the Redirect function in scope.
		var rx = new Redirect();
		rx.copyValues(redirect);
		this._list.push(rx);
		this.save();
	},

	/* this function is called when we receive a new connection */
	onSocketAccepted: function(serverSocket, clientSocket)
	{
		log.debug('Accepted connection on ' + clientSocket.host+":"+clientSocket.port+"\n");

		var input = clientSocket.openInputStream(nsITransport.OPEN_BLOCKING, 0, 0);
		var output = clientSocket.openOutputStream(nsITransport.OPEN_BLOCKING, 0, 0);
		var sin = new ScriptableInputStream(input);
		while (sin.available() > 0) {
			sin.read(512);
		}

		const fixedResponse =
		"HTTP/1.0 302 Moved Temporarily\r\nLocation: http://mbl.is\r\n\r\nFooooopy!!\r\n";
		var response = fixedResponse + "\r\n" + new Date().toString() + "\r\n";
		var n = output.write(response, response.length);
		log.debug("Wrote "+n+" bytes\n");

		input.close();
		output.close();
	},

	onStopListening: function(serverSocket, status) {
		log.debug(">>> shutting down server socket\n");
	},

	startListening: function() {
		log.debug('Start listening...');
		var socket = new ServerSocket(5555, true /* loopback only */, 5);
		log.debug("Listening on port "+socket.port+"\n");
		socket.asyncListen(this);
	},

    proxyFilter : {

        register : function() {
            ProtocolProxyService.registerFilter(this, 0);
        },
        
        unregister : function() {
            ProtocolProxyService.unregisterFilter(this);
        },

        applyFilter : function(service, uri, proxy) {
            return proxy;
        }
    },

	deleteRedirectAt : function(index) {
		this._list.splice(index, 1);
		this.save();
	},
	
	exportRedirects : function(file) {
		const PR_WRONLY 	 = 0x02;
		const PR_CREATE_FILE = 0x08;
		const PR_TRUNCATE	 = 0x20;

		var fileStream = new FileOutputStream(file, PR_WRONLY | PR_CREATE_FILE | PR_TRUNCATE, 0644, 0);

		var stream = new ConverterOutputStream(fileStream, "UTF-8", 16384, nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);
		stream.writeString(this._redirectsAsString('\n'));
		stream.close();
	},
	
	getRedirectAt : function(index) {
		return this._list[index];	
	},
	
	//Get the redirect url for the given url. This will not check if we are enabled, and
	//not do any verification on the url, just assume that it is a good string url that is for http/s
	getRedirectUrl : function(url) {
		log.debug("Checking " + url);
		
		for each (var redirect in this._list) {
			var result = redirect.getMatch(url);
			if (result.isExcludeMatch) {
				log.debug(url + ' matched exclude pattern ' + redirect.excludePattern + ' so the redirect ' + redirect.includePattern + ' will not be used');
			} else if (result.isDisabledMatch) {
				log.debug(url + ' matched pattern ' + redirect.includePattern + ' but the redirect is disabled');
			} else if (result.isMatch) {
				redirectUrl = this._makeAbsoluteUrl(url, result.redirectTo);
				
				//check for loops...
				result = redirect.getMatch(redirectUrl);
				if (result.isMatch) {
					var title = this._getString('invalidRedirectTitle');
					var msg = this._getFormattedString('invalidRedirectText', [redirect.includePattern, url, redirectUrl]);
					log.debug(msg);
					redirect.disabled = true;
					this.save();					
					PromptService.alert(null, title, msg);
				} else {
					log.debug('Redirecting ' + url + ' to ' + redirectUrl);
					return redirectUrl;
				}
			}
		}
		return null;
	},
	
	importRedirects : function(file) {
		var fileStream = new FileInputStream(file, 0x01, 0444, 0); //TODO: Find the actual constants for these magic numbers

		var stream = new ConverterInputStream(fileStream, "UTF-8", 16384, nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);
		stream = stream.QueryInterface(nsIUnicharLineInputStream);

		var importCount = 0, existsCount = 0;
		var lines = [];
		var line = {value: null};
		stream.readLine(line);
		while (line.value) {
			var redirect = new Redirect();
			redirect.deserialize(line.value.replace('\n', ''));
			if (this._containsRedirect(redirect)) {
				existsCount++;
			} else {
				this._list.push(redirect);
				importCount++;
			}
			stream.readLine(line);
		}
		stream.close();
		this.save();
		return importCount | (existsCount << 16);
	},
	
	save : function() {
		this._prefs.redirects = this._redirectsAsString(':::');
	},

	switchItems : function(index1, index2) {
		var item = this._list[index1];
		this._list[index1] = this._list[index2];
		this._list[index2] = item;
		this.save();
	},
	
	//End rdIRedirector    

	// nsIContentPolicy implementation
	shouldLoad: function(contentType, contentLocation, requestOrigin, aContext, mimeTypeGuess, extra) {
		try {
			//This is also done in getRedirectUrl, but we want to exit as quickly as possible for performance
			if (!this._prefs.enabled) {
				return nsIContentPolicy.ACCEPT;
			}
			
			if (contentType != nsIContentPolicy.TYPE_DOCUMENT) {
				return nsIContentPolicy.ACCEPT;
			}

			if (contentLocation.scheme != "http" && contentLocation.scheme != "https") {
				return nsIContentPolicy.ACCEPT;
			}
			
			if (!aContext || !aContext.loadURI) {
				return nsIContentPolicy.ACCEPT;
			}
			
			var redirectUrl = this.getRedirectUrl(contentLocation.spec);

			if (!redirectUrl) {
				return nsIContentPolicy.ACCEPT;
			}			

			aContext.loadURI(redirectUrl, requestOrigin, null);
			return nsIContentPolicy.REJECT_REQUEST;
		} catch(e) {
			log.error(e);	 
		}
	},
	
	shouldProcess: function(contentType, contentLocation, requestOrigin, insecNode, mimeType, extra) {
		return nsIContentPolicy.ACCEPT;
	},
	//end nsIContentPolicy

	//nsIChannelEventSink implementation
	
	//For FF4.0. Got this from a thread about adblock plus, https://adblockplus.org/forum/viewtopic.php?t=5895
	asyncOnChannelRedirect: function(oldChannel, newChannel, flags, redirectCallback) {
		this.onChannelRedirect(oldChannel, newChannel, flags);
		redirectCallback.onRedirectVerifyCallback(0);
	},	
	
	onChannelRedirect: function(oldChannel, newChannel, flags)
	{
		try {
			let newLocation = newChannel.URI.spec;

			if (!(newChannel.loadFlags & nsIChannel.LOAD_DOCUMENT_URI)) {
				//We only redirect documents...
				return; 
			}

			if (!this._prefs.enabled) {
				return;
			}
			
			if (!newLocation) {
				return;
			}
			let callbacks = [];
			if (newChannel.notificationCallbacks) {
				callbacks.push(newChannel.notificationCallbacks);
			}
			if (newChannel.loadGroup && newChannel.loadGroup.notificationCallbacks) {
				callbacks.push(newChannel.loadGroup.notificationCallbacks);
			}
			var win;
			var webNav;
			for each (let callback in callbacks)
			{
				try {
					win = callback.getInterface(nsILoadContext).associatedWindow;
					webNav = win.QueryInterface(nsIInterfaceRequestor).getInterface(nsIWebNavigation);
					break;
				} catch(e) {}
			}
			if (!webNav) {
				return; 
			}
			var redirectUrl = this.getRedirectUrl(newLocation);

			if (redirectUrl) {
				webNav.loadURI(redirectUrl,null,null,null,null);
				throw Cr.NS_BASE_STREAM_WOULD_BLOCK; //Throw this because the real error we should throw shows up in console...
			}			
			
		} catch (e if (e != Cr.NS_BASE_STREAM_WOULD_BLOCK)) {
			// We shouldn't throw exceptions here - this will prevent the redirect.
			log.error("Unexpected error in onChannelRedirect: " + e + "\n");
		}
	},
	//end nsIChannelEventSink
	
	//Private members and methods
			
	_prefs : null,
	_list : null,
	_strings : null,

	_init : function() {
		if (this._prefs) {
			this._prefs.dispose();
		}
		log.info('Redirector created!');
		this._prefs = new RedirectorPrefs();
		//Check if we need to update existing redirects
		var data = this._prefs.redirects;
		var version = this._prefs.version;
		this._loadStrings();
		var currentVersion = '3.0';
		//Here update checks are handled
		if (version == 'undefined') { //Either a fresh install of Redirector, or first time install of v2.0
			if (data) { //There is some data in redirects, we are upgrading from a previous version, need to upgrade data
				var tempList = JSON.parse(data);
				var arr;
				var newArr = []
				for each (arr in tempList) {
					if (arr.length == 5) {
						arr.push(''); //For those that don't have an exclude pattern. Backwards compatibility is a bitch!
					}
					arr.splice(3,1); //Remove the "only if link exists" data
					newArr.push(arr.join(',,,'));
				}
				this._prefs.redirects = newArr.join(':::');
			}
			this._prefs.version = currentVersion;
		} else {
			this._prefs.version = currentVersion;
		}
		//Update finished
		
		//Now get from the new format
		data = this._prefs.redirects;
		var arr;
		this._list = [];
		if (data != '') {
			for each (redirectString in data.split(':::')) {
				var redirect = new Redirect();
				redirect.deserialize(redirectString);
				this._list.push(redirect);
			}
		}
		this.startListening();
		this.proxyFilter.register();
	},
	
	_loadStrings : function() {
		var src = 'chrome://redirector/locale/redirector.properties';
		var appLocale = LocaleService.getApplicationLocale();
		this._strings = StringBundleService.createBundle(src, appLocale);	 
	},	  

	_redirectsAsString : function(seperator) {
		return [r.serialize() for each (r in this._list)].join(seperator);
	},
	
	
	_containsRedirect : function(redirect) {
		for each (var existing in this._list) {
			if (existing.equals(redirect)) {
				return true;
			}	
		}
		return false;
	},
	
	_getString : function(name) {
		return this._strings.GetStringFromName(name);
	},
	
	_getFormattedString : function(name, params) {
		return this._strings.formatStringFromName(name, params, params.length);
	},
	
	_makeAbsoluteUrl : function(currentUrl, relativeUrl) {
		
		if (relativeUrl.match(/https?:/)) {
			return relativeUrl;
		} 
		
		var uri = IOService.newURI(currentUrl, null, null); 
		return uri.resolve(relativeUrl);
	},
	
	//XPCOM Registration
	classDescription 	: "Redirector Component",
	classID				: Components.ID("{b7a7a54f-0581-47ff-b086-d6920cb7a3f7}"),
	contractID			: "@einaregilsson.com/redirector;1",
	_xpcom_categories 	: [{category:'content-policy'},{category:'net-channel-event-sinks'}],
	QueryInterface		: XPCOMUtils.generateQI([nsIContentPolicy, nsIChannelEventSink, rdIRedirector]),
	_xpcom_factory		: {
		createInstance: function(outer, iid) {
			if (outer) throw Cr.NS_ERROR_NO_AGGREGATION;
			if (!Redirector.instance) {
				log.debug('Creating new instance of Redirector');
				Redirector.instance = new Redirector();	
			} else {
				log.debug('Returning existing instance of Redirector');
			}
			return Redirector.instance.QueryInterface(iid);
		}
	}
};

if (XPCOMUtils.generateNSGetFactory)
    var NSGetFactory = XPCOMUtils.generateNSGetFactory([Redirector]);
else
    var NSGetModule = XPCOMUtils.generateNSGetModule([Redirector]);
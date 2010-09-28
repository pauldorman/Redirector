
var EXPORTED_SYMBOLS = [
	'Ci','Cr','Cc','Cu', 
	'log', 
	'ServerSocket', 'ScriptableInputStream', 'FileOutputStream', 'ConverterOutputStream', 'FileInputStream', 'ConverterInputStream', 'LocalFile', 'FilePicker',
	'LocaleService', 'StringBundleService', 'PromptService', 'IOService', 'WindowMediator', 'ProtocolProxyService',
	'nsIConverterInputStream', 'nsIUnicharLineInputStream', 'nsIContentPolicy', 'nsIChannel', 'nsILoadContext', 'nsIInterfaceRequestor', 'nsIWebNavigation', 'nsIChannelEventSink', 'rdIRedirector', 'nsITransport', 'nsIFilePicker'];

const Ci = Components.interfaces;
const Cr = Components.results;
const Cc = Components.classes;
const Cu = Components.utils;

//Logging
var log = {
	debug : function(msg) {
		this._write(msg, 'DEBUG');
	},
	info : function(msg) {
		this._write(msg, 'INFO');
	},
	error : function(msg) {
		this._write(msg, 'ERROR');
	},
	
	_write : function(msg, category) {
		dump(category + ': ' + msg);
	}
};

//Nicer references to interfaces
const nsIConverterInputStream = Ci.nsIConverterInputStream;
const nsIUnicharLineInputStream = Ci.nsIUnicharLineInputStream;
const nsIContentPolicy = Ci.nsIContentPolicy;
const nsIChannel = Ci.nsIChannel;
const nsILoadContext = Ci.nsILoadContext;
const nsIInterfaceRequestor = Ci.nsIInterfaceRequestor;
const nsIWebNavigation = Ci.nsIWebNavigation;
const nsIChannelEventSink = Ci.nsIChannelEventSink;
const rdIRedirector = Ci.rdIRedirector;
const nsITransport = Ci.nsITransport;
const nsIFilePicker = Ci.nsIFilePicker;

//Nicer xpcom constructor for javascript
const ServerSocket 				= Components.Constructor('@mozilla.org/network/server-socket;1', 'nsIServerSocket', 'init');
const ScriptableInputStream 	= Components.Constructor('@mozilla.org/scriptableinputstream;1', 'nsIScriptableInputStream', 'init');
const FileOutputStream			= Components.Constructor('@mozilla.org/network/file-output-stream;1', 'nsIFileOutputStream', 'init');
const ConverterOutputStream		= Components.Constructor('@mozilla.org/intl/converter-output-stream;1', 'nsIConverterOutputStream', 'init');
const FileInputStream			= Components.Constructor('@mozilla.org/network/file-input-stream;1', 'nsIFileInputStream', 'init');
const ConverterInputStream		= Components.Constructor('@mozilla.org/intl/converter-input-stream;1', 'nsIConverterInputStream', 'init');
const LocalFile 				= Components.Constructor('@mozilla.org/file/local;1', 'nsILocalFile', 'initWithPath');
const FilePicker				= Components.Constructor('@mozilla.org/filepicker;1', 'nsIFilePicker', 'init');

//Nicer services
const LocaleService				= Cc['@mozilla.org/intl/nslocaleservice;1'].getService(Ci.nsILocaleService);
const StringBundleService		= Cc['@mozilla.org/intl/stringbundle;1'].getService(Ci.nsIStringBundleService);
const PromptService				= Cc['@mozilla.org/embedcomp/prompt-service;1'].getService(Ci.nsIPromptService)
const IOService					= Cc['@mozilla.org/network/io-service;1'].getService(Ci.nsIIOService);
const WindowMediator 			= Cc['@mozilla.org/appshell/window-mediator;1'].getService(Ci.nsIWindowMediator);
const ProtocolProxyService		= Cc['@mozilla.org/network/protocol-proxy-service;1'].getService(Ci.nsIProtocolProxyService);


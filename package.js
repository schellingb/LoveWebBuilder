/*
  LÖVE Web Builder
  Copyright (C) 2018 Bernhard Schelling

  This software is provided 'as-is', without any express or implied
  warranty.  In no event will the authors be held liable for any damages
  arising from the use of this software.

  Permission is granted to anyone to use this software for any purpose,
  including commercial applications, and to alter it and redistribute it
  freely, subject to the following restrictions:

  1. The origin of this software must not be misrepresented; you must not
     claim that you wrote the original software. If you use this software
     in a product, an acknowledgment in the product documentation would be
     appreciated but is not required.
  2. Altered source versions must be plainly marked as such, and must not be
     misrepresented as being the original software.
  3. This notice may not be removed or altered from any source distribution.
*/

/**
 * @license
 * zlib.js
 * JavaScript Zlib Library
 * https://github.com/imaya/zlib.js
 *
 * The MIT License
 *
 * Copyright (c) 2012 imaya
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

if (typeof window === 'object') (function() { //-------------- WEBPAGE ------------------

var $ = function(i) { return document.getElementById(i); };
var build = $('build'), step = $('step'), progress = $('progress'), worker;
build.disabled = false;
build.onclick = function()
{
	build.blur();
	build.disabled = true;
	step.innerText = 'Downloading...';
	progress.value = 0;
	step.style.display = progress.style.display = '';
	if (!worker)
	{
		worker = new Worker('package.js');
		worker.onmessage = function(e)
		{
			if (e.data.progress)
			{
				progress.value = e.data.progress.f;
			}
			else if (e.data.error)
			{
				if (!e.data.error.status) alert('Unknown error while downloading script data.\nCheck your internet connection.');
				else alert('Error while downloading script data: ' + e.data.error.status + '.\nCheck your internet connection.');
				build.disabled = false;
			}
			else if (e.data.get_file)
			{
				var i = e.data.get_file.i;
				if (i == 0) { step.innerText = 'Building...'; progress.removeAttribute('value'); }
				var f = $('file').files;
				if (i < f.length) worker.postMessage({file: {i:i, file:f[i], num_files:f.length}});
				else worker.postMessage({build:{
						mode:$('mode').value, filename:($('filename').value||'game'), title:$('title').value, description:$('description').value, author:$('author').value,
						res_x:$('res_x').value, res_y:$('res_y').value, memory:$('memory').value, stack:$('stack').value
					}});
			}
			else if (e.data.result)
			{
				var zipname = ($('filename').value||'game')+'.zip', zipblob = [e.data.result], zipprops = {type: 'application/zip'};
				try { file = new File(zipblob, '', zipprops); } catch (ex) { file = new Blob(zipblob, zipprops); }
				if (navigator && navigator.msSaveOrOpenBlob) navigator.msSaveOrOpenBlob(file, zipname);
				else
				{
					var a = document.createElement('a');
					a.href = URL.createObjectURL(file);
					a.download = zipname;
					a.style.display = 'none';
					document.body.appendChild(a);
					a.click();
					document.body.removeChild(a);
				}
				step.style.display = progress.style.display = 'none';
				build.disabled = false;
			}
			else { alert(e.data); }
		};
	}
	worker.postMessage({start: {jsurl:document.location.href.split('/').slice(0,-1).join('/') + '/love.js'}});
};

})(); else (function() { //-------------- WEBWORKER ------------------

var fsjs, lovejs, RunArg;
self.onmessage = function(e)
{
	if (e.data.start)
	{
		fsjs = '';
		if (lovejs) self.postMessage({get_file: {i:0}});
		else
		{
			var xhr = new XMLHttpRequest();
			xhr.open('GET', e.data.start.jsurl);
			xhr.onprogress = function(e) { if (e.lengthComputable) self.postMessage({progress: {f:e.loaded/e.total}}) };
			xhr.onerror = xhr.onabort = function() { self.postMessage({error: {}}) };
			xhr.onload = function()
			{
				if (xhr.status != 200) { self.postMessage({error: {status: xhr.statusText}}); return; }
				lovejs = xhr.response;
				self.postMessage({get_file: {i:0}});
			}
			xhr.send();
		}
	}
	else if (e.data.file)
	{
		var f = e.data.file, reader = new FileReader();
		reader.onloadend = function(e)
		{
			function encode64(data)
			{
				var BASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
				var ret = '', leftchar = 0, leftbits = 0;
				for (var i = 0, il = data.length; i != il; i++)
				{
					leftchar = leftchar << 8 | data[i];
					for (leftbits += 8; leftbits >= 6; leftbits -= 6) ret += BASE[leftchar >> leftbits - 6 & 63];
				}
				if (leftbits == 2) { ret += BASE[(leftchar & 3) << 4]; ret += '==' }
				else if (leftbits == 4) { ret += BASE[(leftchar & 15) << 2]; ret += '=' }
				return ret
			}

			var r = e.target.result, fsname =  '/l/'+f.file.name;
			if (f.i == 0)
			{
				if (f.num_files == 1 && r.byteLength >= 4 && (new Uint32Array(r, 0, 1))[0] == 67324752)
				{
					//Uploaded a single ZIP file
					if (false)
					{
						//Unzip content of .LOVE package for perhaps faster loading?
						fsjs += "FS.mkdir('/l');\n";
						var unzip = new Zlib.Unzip(new Uint8Array(r));
						var filenames = unzip.getFilenames();
						for (var i = 0, fn; fn = filenames[i++];)
						{
							if (fn.slice(-1)=='/') { fsjs += "FS.mkdir('/l/" + fn.slice(0, -1) + "');\n"; continue; }
							fsjs += "FS.createDataFile('/l/"+fn+"',0,FS.DEC('";
							fsjs += encode64(unzip.decompress(fn))
							fsjs += "'),!0,!0,!0);\n";
						}
						RunArg = '/l';
						r = null;
					}
					else
					{
						RunArg = fsname = '/p';
					}
				}
				else if (f.num_files == 1)
				{
					//Uploaded a single LUA file
					RunArg = '/';
					fsname = '/main.lua';
				}
				else
				{
					//Uploading multiple files
					fsjs += "FS.mkdir('/l');\n";
					RunArg = '/l';
				}
			}

			if (r)
			{
				fsjs += "FS.createDataFile('" + fsname + "',0,FS.DEC('";
				fsjs += encode64(new Uint8Array(r))
				fsjs += "'),!0,!0,!0);\n";
			}
			self.postMessage({get_file: {i:f.i+1}});
		};
		reader.readAsArrayBuffer(f.file);
	}
	else if (e.data.build)
	{
		var b = e.data.build;

		var html = '', nl = '\n';
		html += '<!DOCTYPE html>'+nl;
		html += '<html lang="en-us">'+nl;
		html += '<head>'+nl;
		html += '	<meta charset="utf-8">'+nl;
		html += '	<meta name="viewport" content="width=device-width, initial-scale=1">'+nl;
		html += '	<title>'+(b.title ? b.title : 'LÖVE Game')+'</title>'+nl;
		html += '	<style type="text/css">'+nl;
		html += 'html, body'+nl;
		html += '{'+nl;
		html += '	background-color: #e0f4fc;'+nl;
		html += '	margin: 0;'+nl;
		html += '	height: 100%;'+nl;
		html += '	font-family: sans-serif;'+nl;
		html += '	font-size: 18px;'+nl;
		html += '}'+nl;
		html += '#wrapper'+nl;
		html += '{'+nl;
		html += '	margin: 0 0 -21px;'+nl;
		html += '	padding: 1px;'+nl;
		html += '	min-height: 100%;'+nl;
		html += '	border-bottom: 21px solid transparent;'+nl;
		html += '	box-sizing: border-box;'+nl;
		html += '}'+nl;
		if (b.title)
		{
			html += '#title'+nl;
			html += '{'+nl;
			html += '	background-color: #ea316e;'+nl;
			html += '	margin: 9px;'+nl;
			html += '	padding: .8em;'+nl;
			html += '	border: 1px solid black;'+nl;
			html += '	border-radius: 10px;'+nl;
			html += '	box-shadow: 3px 3px 0 0 rgba(0,0,0,0.3);'+nl;
			html += '	text-align: center;'+nl;
			html += '	color: #f5f5f5;'+nl;
			html += '}'+nl;
		}
		html += '#main'+nl;
		html += '{'+nl;
		html += '	background-color: #b1e3fa;'+nl;
		html += '	margin: 9px;'+nl;
		html += '	padding: 15px 0;'+nl;
		html += '	border: 1px solid black;'+nl;
		html += '	border-radius: 10px;'+nl;
		html += '	box-shadow: 3px 3px 0 0 rgba(0,0,0,0.3);'+nl;
		html += '}'+nl;
		if (b.description)
		{
			html += '#main a { color: #526ffc; }'+nl;
			html += '#main a:hover, #main a:active { color: #f2f2f2; background: #ea316e; }'+nl;
		}
		html += '#footer'+nl
		html += '{'+nl;
		html += '	background-color: #b1e3fa;'+nl;
		html += '	padding-top: 3px;'+nl;
		html += '	height: 17px;'+nl;
		html += '	border-top: 1px dashed #77A;'+nl;
		html += '	color: #444;'+nl;
		html += '	font-size: 9pt;'+nl;
		html += '	text-align: center;'+nl;
		html += '	overflow-y: auto;'+nl;
		html += '}'+nl;
		html += '#footer a { color: #77A; }'+nl;
		html += '#footer a:hover, #footera:active { color: #ea316e; }'+nl;
		html += '@media (max-width: 850px)'+nl;
		html += '{'+nl;
		html += '	#wrapper { font-size: 80%; }'+nl;
		html += '	#title { padding: .2em; }'+nl;
		html += '}'+nl;
		html += '	</style>'+nl;
		html += '</head>'+nl;
		html += '<body>'+nl;
		html += '<div id="wrapper">'+nl;
		if (b.title)
		{
			html += '	<h1 id="title">'+b.title+'</h1>'+nl;
		}
		html += '	<div id="main">'+nl;
		if (b.description)
		{
			html += '		<center style="margin-bottom:10px">'+b.description+'</center>'+nl;
		}
		html += '		<center><canvas id="canvas" width="'+b.res_x+'" height="'+b.res_y+'" style="max-width:100%;background:#000;vertical-align:middle"></canvas></center>'+nl;
		html += '	</div>'+nl;
		html += '</div>'+nl;
		html += '<div id="footer">'+(b.author ? '&copy; '+b.author+' &middot; ' : '')+'Made using the <a href="https://love2d.org/" target="_blank">LÖVE Framework</a> (<a href="https://raw.githubusercontent.com/love2d/love/main/license.txt" target="_blank">License</a>) &middot; Packaged using <a href="https://schellingb.github.io/LoveWebBuilder/" target="_blank">LÖVE Web Builder</a></div>'+nl;
		html += '<scr'+'ipt type="text/javascript">(function(){'+nl;
		html += "var TXT ="+nl;
		html += "{"+nl;
		html += "	PLAYBTN: 'Click here to launch the game',"+nl;
		html += "	LOAD:    'Downloading Game',"+nl;
		if (b.mode == 'double_progress')
		{
			html += "	PARSE:   'Preparing Game',"+nl;
		}
		html += "	EXECUTE: 'Starting Game',"+nl;
		if (b.mode != 'single')
		{
			html += "	DLERROR: 'Error while downloading game data.\\nCheck your internet connection.',"+nl;
		}
		html += "	NOWEBGL: 'Your browser or graphics card does not seem to support <a href=\"http://khronos.org/webgl/wiki/Getting_a_WebGL_Implementation\">WebGL</a>.<br>Find out how to get it <a href=\"http://get.webgl.org/\">here</a>.',"+nl;
		html += "};"+nl;
		html += "var canvas = document.getElementById('canvas'), ctx;"+nl;
		html += "var Msg = function(m)"+nl;
		html += "{"+nl;
		html += "	ctx.clearRect(0, 0, canvas.width, canvas.height);"+nl;
		html += "	ctx.fillStyle = '#888';"+nl;
		html += "	for (var i = 0, a = m.split('\\n'), n = a.length; i != n; i++)"+nl;
		html += "		ctx.fillText(a[i], canvas.width/2, canvas.height/2-(n-1)*20+10+i*40);"+nl;
		html += "};"+nl;
		html += "var Fail = function(m)"+nl;
		html += "{"+nl;
		html += "	canvas.outerHTML = '<div style=\"max-width:90%;width:'+canvas.clientWidth+'px;height:'+canvas.clientHeight+'px;background:#000;display:table-cell;vertical-align:middle\"><div style=\"background-color:#FFF;color:#000;padding:1.5em;max-width:640px;width:80%;margin:auto;text-align:center\">'+TXT.NOWEBGL+(m?'<br><br>'+m:'')+'</div></div>';"+nl;
		html += "};"+nl;
		html += "var DoExecute = function()"+nl;
		html += "{"+nl;
		html += "	Msg(TXT.EXECUTE);"+nl;
		html += "	Module.canvas = canvas.cloneNode(false);"+nl;
		html += "	Module.canvas.oncontextmenu = function(e) { e.preventDefault() };"+nl;
		html += "	Module.setWindowTitle = function(title) { };"+nl;
		html += "	Module.postRun = function()"+nl;
		html += "	{"+nl;
		html += "		if (!Module.noExitRuntime) { Fail(); return; }"+nl;
		html += "		canvas.parentNode.replaceChild(Module.canvas, canvas);"+nl;
		html += "		Txt = Msg = ctx = canvas = null;"+nl;
		html += "		Module.canvas.focus();"+nl;
		html += "	};"+nl;
		html += "	setTimeout(function() { Module.run(['" + RunArg + "']); }, 50);"+nl;
		html += "};"+nl;
		if (b.mode == 'double_local')
		{
			html += "var DoLoad = function()"+nl;
			html += "{"+nl;
			html += "	Msg(TXT.LOAD);"+nl;
			html += "	window.onerror = function(e,u,l) { Fail(e+'<br>('+u+':'+l+')'); };"+nl;
			html += "	Module = { TOTAL_MEMORY: 1024*1024*"+(b.memory||20)+", TOTAL_STACK: 1024*1024*"+(b.stack||20)+", currentScriptUrl: '-', preInit: DoExecute };"+nl;
			html += "	var s = document.createElement('script'), d = document.documentElement;"+nl;
			html += "	s.src = '"+b.filename+".js';"+nl;
			html += "	s.async = true;"+nl;
			html += "	s.onerror = function(e) { d.removeChild(s); Msg(TXT.DLERROR); canvas.disabled = false; };"+nl;
			html += "	d.appendChild(s);"+nl;
			html += "};"+nl;
		}
		if (b.mode == 'double_progress')
		{
			html += "var DoLoad = function()"+nl;
			html += "{"+nl;
			html += "	Msg(TXT.LOAD);"+nl;
			html += "	var xhr = new XMLHttpRequest();"+nl;
			html += "	xhr.open('GET', '"+b.filename+".js');"+nl;
			html += "	xhr.onprogress = function(e)"+nl;
			html += "	{"+nl;
			html += "		if (!e.lengthComputable || ctx.pCnt++ < 5) return;"+nl;
			html += "		var x = canvas.width/2-150, y = canvas.height*.6, w = Math.min(e.loaded/e.total,1)*300, g = ctx.createLinearGradient(x,0,x+w,0);"+nl;
			html += "		g.addColorStop(0,'#72d3ff');g.addColorStop(1,'#a2d4ea');"+nl;
			html += "		ctx.fillStyle = '#1497ce'; ctx.fillRect(x-2,y-2,304,28);"+nl;
			html += "		ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x  ,y  ,300,24);"+nl;
			html += "		ctx.fillStyle = g;         ctx.fillRect(x  ,y  ,w,  24);"+nl;
			html += "	};"+nl;
			html += "	xhr.onerror = xhr.onabort = function() { Msg(TXT.DLERROR); canvas.disabled = false; };"+nl;
			html += "	xhr.onload = function()"+nl;
			html += "	{"+nl;
			html += "		if (xhr.status != 200) { Msg(TXT.DLERROR + '<br>Status: ' + xhr.statusText ); canvas.disabled = false; return; }"+nl;
			html += "		Msg(TXT.PARSE);"+nl;
			html += "		setTimeout(function()"+nl;
			html += "		{"+nl;
			html += "			window.onerror = function(e,u,l) { Fail(e+'<br>('+u+':'+l+')'); };"+nl;
			html += "			Module = { TOTAL_MEMORY: 1024*1024*"+(b.memory||20)+", TOTAL_STACK: 1024*1024*"+(b.stack||20)+", currentScriptUrl: '-', preInit: DoExecute };"+nl;
			html += "			var s = document.createElement('script'), d = document.documentElement;"+nl;
			html += "			s.textContent = xhr.response;"+nl;
			html += "			d.appendChild(s);"+nl;
			html += "			d.removeChild(s);"+nl;
			html += "			xhr = xhr.response = s = s.textContent = null;"+nl;
			html += "		},50);"+nl;
			html += "	};"+nl;
			html += "	xhr.send();"+nl;
			html += "}"+nl;
		}
		html += "var DoSetup = function()"+nl;
		html += "{"+nl;
		html += "	canvas.onclick = function()"+nl;
		html += "	{"+nl;
		html += "		if (canvas.disabled) return;"+nl;
		html += "		canvas.disabled = true;"+nl;
		html += "		canvas.scrollIntoView();"+nl;
		if (b.mode == 'double_progress')
		{
			html += "		ctx.pCnt = 0;"+nl;
		}
		if (b.mode != 'single')
		{
			html += "		DoLoad();"+nl;
		}
		else
		{
			html += "		DoExecute();"+nl;
		}
		html += "	};"+nl;
		html += "	ctx.fillStyle = '#888';"+nl;
		html += "	ctx.fillRect(canvas.width/2-254, canvas.height/2-104, 508, 208);"+nl;
		html += "	ctx.fillStyle = '#333';"+nl;
		html += "	ctx.fillRect(canvas.width/2-250, canvas.height/2-100, 500, 200);"+nl;
		html += "	ctx.fillStyle = '#888';"+nl;
		html += "	ctx.fillText(TXT.PLAYBTN, canvas.width/2, canvas.height/2+10);"+nl;
		html += "};"+nl;
		html += "canvas.oncontextmenu = function(e) { e.preventDefault() };"+nl;
		html += "ctx = canvas.getContext('2d');"+nl;
		html += "ctx.font = '30px sans-serif';"+nl;
		html += "ctx.textAlign = 'center';"+nl;
		if (b.mode != 'single')
		{
			html += "DoSetup();"+nl;
		}
		else
		{
			html += "Msg(TXT.LOAD);"+nl;
			html += "window.onerror = function(e,u,l) { Fail(e+'<br>('+u+':'+l+')'); };"+nl;
			html += "Module = { TOTAL_MEMORY: 1024*1024*"+(b.memory||20)+", TOTAL_STACK: 1024*1024*"+(b.stack||20)+", currentScriptUrl: '-', preInit: DoSetup };"+nl;
		}
		html += '})()</scr'+'ipt>'+nl;

		var zip = new Zlib.Zip();
		if (b.mode != 'single')
		{
			html += '</html>'+nl+'</body>'+nl;
			zip.addFile(new StringUTF8ToUint8(lovejs + fsjs), { filename: StringUTF8ToUint8(b.filename+'.js') }); lovejs = fsjs = null;
			zip.addFile(new StringUTF8ToUint8(html), { filename: StringUTF8ToUint8(b.filename+'.html') }); html = null;
		}
		else
		{
			html += '<scr'+'ipt type="text/javascript">'+nl;
			html += lovejs; lovejs = null;
			html += fsjs; fsjs = null;
			html += '</scr'+'ipt>'+nl+'</html>'+nl+'</body>'+nl;
			zip.addFile(new StringUTF8ToUint8(html), { filename: StringUTF8ToUint8(b.filename+'.html') }); html = null;
		}
		self.postMessage({result: zip.compress()});
	};
};

StringUTF8ToUint8 = (function()
{
	if (typeof TextEncoder !== 'undefined')
	{
		var te = new TextEncoder('utf-8');
		return function(e) { return te.encode(e) };
	}
	return function(e)
	{
		"use strict";
		for(var n=e.length,r=-1,i=new Uint8Array(3*n),t=0,f=0,a=0;a!==n;){if(t=e.charCodeAt(a),a+=1,55296<=t&&t<=56319){if(a===n){i[r+=1]=239,i[r+=1]=191,i[r+=1]=189;break}if(!(56320<=(f=e.charCodeAt(a))&&f<=57343)){i[r+=1]=239,i[r+=1]=191,i[r+=1]=189;continue}if(a+=1,65535<(t=1024*(t-55296)+f-56320+65536)){i[r+=1]=240|t>>>18,i[r+=1]=128|t>>>12&63,i[r+=1]=128|t>>>6&63,i[r+=1]=128|63&t;continue}}t<=127?i[r+=1]=0|t:(t<=2047?i[r+=1]=192|t>>>6:(i[r+=1]=224|t>>>12,i[r+=1]=128|t>>>6&63),i[r+=1]=128|63&t)}
		return new Uint8Array(i.buffer.slice(0,r+1))
	};
})();

function StringAsciiToUint8(str)
{
	var array = new Uint8Array(str.length);
	for (var i = 0, il = str.length; i < il; ++i) array[i] = str.charCodeAt(i) & 0xff;
	return array;
}

/*** zlib.js ***/(function(){'use strict';var CRC32Table = new Uint32Array([0,1996959894,3993919788,2567524794,124634137,1886057615,3915621685,2657392035,249268274,2044508324,3772115230,2547177864,162941995,2125561021,3887607047,2428444049,498536548,1789927666,4089016648,2227061214,450548861,1843258603,4107580753,2211677639,325883990,1684777152,4251122042,2321926636,335633487,1661365465,4195302755,2366115317,997073096,1281953886,3579855332,2724688242,1006888145,1258607687,3524101629,2768942443,901097722,1119000684,3686517206,2898065728,853044451,1172266101,3705015759,
2882616665,651767980,1373503546,3369554304,3218104598,565507253,1454621731,3485111705,3099436303,671266974,1594198024,3322730930,2970347812,795835527,1483230225,3244367275,3060149565,1994146192,31158534,2563907772,4023717930,1907459465,112637215,2680153253,3904427059,2013776290,251722036,2517215374,3775830040,2137656763,141376813,2439277719,3865271297,1802195444,476864866,2238001368,4066508878,1812370925,453092731,2181625025,4111451223,1706088902,314042704,2344532202,4240017532,1658658271,366619977,
2362670323,4224994405,1303535960,984961486,2747007092,3569037538,1256170817,1037604311,2765210733,3554079995,1131014506,879679996,2909243462,3663771856,1141124467,855842277,2852801631,3708648649,1342533948,654459306,3188396048,3373015174,1466479909,544179635,3110523913,3462522015,1591671054,702138776,2966460450,3352799412,1504918807,783551873,3082640443,3233442989,3988292384,2596254646,62317068,1957810842,3939845945,2647816111,81470997,1943803523,3814918930,2489596804,225274430,2053790376,3826175755,
2466906013,167816743,2097651377,4027552580,2265490386,503444072,1762050814,4150417245,2154129355,426522225,1852507879,4275313526,2312317920,282753626,1742555852,4189708143,2394877945,397917763,1622183637,3604390888,2714866558,953729732,1340076626,3518719985,2797360999,1068828381,1219638859,3624741850,2936675148,906185462,1090812512,3747672003,2825379669,829329135,1181335161,3412177804,3160834842,628085408,1382605366,3423369109,3138078467,570562233,1426400815,3317316542,2998733608,733239954,1555261956,
3268935591,3050360625,752459403,1541320221,2607071920,3965973030,1969922972,40735498,2617837225,3943577151,1913087877,83908371,2512341634,3803740692,2075208622,213261112,2463272603,3855990285,2094854071,198958881,2262029012,4057260610,1759359992,534414190,2176718541,4139329115,1873836001,414664567,2282248934,4279200368,1711684554,285281116,2405801727,4167216745,1634467795,376229701,2685067896,3608007406,1308918612,956543938,2808555105,3495958263,1231636301,1047427035,2932959818,3654703836,1088359270,
936918E3,2847714899,3736837829,1202900863,817233897,3183342108,3401237130,1404277552,615818150,3134207493,3453421203,1423857449,601450431,3009837614,3294710456,1567103746,711928724,3020668471,3272380065,1510334235,755167117]);
(function(V) {'use strict';var n=void 0,y=!0,aa=this;function G(e,b){var a=e.split("."),d=aa;!(a[0]in d)&&d.execScript&&d.execScript("var "+a[0]);for(var c;a.length&&(c=a.shift());)!a.length&&b!==n?d[c]=b:d=d[c]?d[c]:d[c]={}};var H="undefined"!==typeof Uint8Array&&"undefined"!==typeof Uint16Array&&"undefined"!==typeof Uint32Array&&"undefined"!==typeof DataView;function ba(e,b){this.index="number"===typeof b?b:0;this.f=0;this.buffer=e instanceof(H?Uint8Array:Array)?e:new (H?Uint8Array:Array)(32768);if(2*this.buffer.length<=this.index)throw Error("invalid index");this.buffer.length<=this.index&&ca(this)}function ca(e){var b=e.buffer,a,d=b.length,c=new (H?Uint8Array:Array)(d<<1);if(H)c.set(b);else for(a=0;a<d;++a)c[a]=b[a];return e.buffer=c}
ba.prototype.b=function(e,b,a){var d=this.buffer,c=this.index,f=this.f,l=d[c],p;a&&1<b&&(e=8<b?(L[e&255]<<24|L[e>>>8&255]<<16|L[e>>>16&255]<<8|L[e>>>24&255])>>32-b:L[e]>>8-b);if(8>b+f)l=l<<b|e,f+=b;else for(p=0;p<b;++p)l=l<<1|e>>b-p-1&1,8===++f&&(f=0,d[c++]=L[l],l=0,c===d.length&&(d=ca(this)));d[c]=l;this.buffer=d;this.f=f;this.index=c};ba.prototype.finish=function(){var e=this.buffer,b=this.index,a;0<this.f&&(e[b]<<=8-this.f,e[b]=L[e[b]],b++);H?a=e.subarray(0,b):(e.length=b,a=e);return a};
var da=new (H?Uint8Array:Array)(256),ha;for(ha=0;256>ha;++ha){for(var U=ha,ja=U,ka=7,U=U>>>1;U;U>>>=1)ja<<=1,ja|=U&1,--ka;da[ha]=(ja<<ka&255)>>>0}var L=da;function la(e){var b=n,a,d="number"===typeof b?b:b=0,c=e.length;a=-1;for(d=c&7;d--;++b)a=a>>>8^V[(a^e[b])&255];for(d=c>>3;d--;b+=8)a=a>>>8^V[(a^e[b])&255],a=a>>>8^V[(a^e[b+1])&255],a=a>>>8^V[(a^e[b+2])&255],a=a>>>8^V[(a^e[b+3])&255],a=a>>>8^V[(a^e[b+4])&255],a=a>>>8^V[(a^e[b+5])&255],a=a>>>8^V[(a^e[b+6])&255],a=a>>>8^V[(a^e[b+7])&255];return(a^4294967295)>>>0}
function na(e){this.buffer=new (H?Uint16Array:Array)(2*e);this.length=0}na.prototype.getParent=function(e){return 2*((e-2)/4|0)};na.prototype.push=function(e,b){var a,d,c=this.buffer,f;a=this.length;c[this.length++]=b;for(c[this.length++]=e;0<a;)if(d=this.getParent(a),c[a]>c[d])f=c[a],c[a]=c[d],c[d]=f,f=c[a+1],c[a+1]=c[d+1],c[d+1]=f,a=d;else break;return this.length};
na.prototype.pop=function(){var e,b,a=this.buffer,d,c,f;b=a[0];e=a[1];this.length-=2;a[0]=a[this.length];a[1]=a[this.length+1];for(f=0;;){c=2*f+2;if(c>=this.length)break;c+2<this.length&&a[c+2]>a[c]&&(c+=2);if(a[c]>a[f])d=a[f],a[f]=a[c],a[c]=d,d=a[f+1],a[f+1]=a[c+1],a[c+1]=d;else break;f=c}return{index:e,value:b,length:this.length}};function pa(e,b){this.k=qa;this.l=0;this.input=H&&e instanceof Array?new Uint8Array(e):e;this.e=0;b&&(b.lazy&&(this.l=b.lazy),"number"===typeof b.compressionType&&(this.k=b.compressionType),b.outputBuffer&&(this.c=H&&b.outputBuffer instanceof Array?new Uint8Array(b.outputBuffer):b.outputBuffer),"number"===typeof b.outputIndex&&(this.e=b.outputIndex));this.c||(this.c=new (H?Uint8Array:Array)(32768))}var qa=2,sa=[],Y;
for(Y=0;288>Y;Y++)switch(y){case 143>=Y:sa.push([Y+48,8]);break;case 255>=Y:sa.push([Y-144+400,9]);break;case 279>=Y:sa.push([Y-256+0,7]);break;case 287>=Y:sa.push([Y-280+192,8]);break;default:throw"invalid literal: "+Y;}
pa.prototype.g=function(){var e,b,a,d,c=this.input;switch(this.k){case 0:a=0;for(d=c.length;a<d;){b=H?c.subarray(a,a+65535):c.slice(a,a+65535);a+=b.length;var f=b,l=a===d,p=n,k=n,q=n,w=n,u=n,m=this.c,h=this.e;if(H){for(m=new Uint8Array(this.c.buffer);m.length<=h+f.length+5;)m=new Uint8Array(m.length<<1);m.set(this.c)}p=l?1:0;m[h++]=p|0;k=f.length;q=~k+65536&65535;m[h++]=k&255;m[h++]=k>>>8&255;m[h++]=q&255;m[h++]=q>>>8&255;if(H)m.set(f,h),h+=f.length,m=m.subarray(0,h);else{w=0;for(u=f.length;w<u;++w)m[h++]=
f[w];m.length=h}this.e=h;this.c=m}break;case 1:var s=new ba(H?new Uint8Array(this.c.buffer):this.c,this.e);s.b(1,1,y);s.b(1,2,y);var t=ta(this,c),r,Q,z;r=0;for(Q=t.length;r<Q;r++)if(z=t[r],ba.prototype.b.apply(s,sa[z]),256<z)s.b(t[++r],t[++r],y),s.b(t[++r],5),s.b(t[++r],t[++r],y);else if(256===z)break;this.c=s.finish();this.e=this.c.length;break;case qa:var A=new ba(H?new Uint8Array(this.c.buffer):this.c,this.e),F,I,N,B,C,g=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15],J,ea,O,W,X,oa=Array(19),
ya,Z,ia,D,za;F=qa;A.b(1,1,y);A.b(F,2,y);I=ta(this,c);J=ua(this.p,15);ea=va(J);O=ua(this.o,7);W=va(O);for(N=286;257<N&&0===J[N-1];N--);for(B=30;1<B&&0===O[B-1];B--);var Aa=N,Ba=B,P=new (H?Uint32Array:Array)(Aa+Ba),v,R,x,fa,M=new (H?Uint32Array:Array)(316),K,E,S=new (H?Uint8Array:Array)(19);for(v=R=0;v<Aa;v++)P[R++]=J[v];for(v=0;v<Ba;v++)P[R++]=O[v];if(!H){v=0;for(fa=S.length;v<fa;++v)S[v]=0}v=K=0;for(fa=P.length;v<fa;v+=R){for(R=1;v+R<fa&&P[v+R]===P[v];++R);x=R;if(0===P[v])if(3>x)for(;0<x--;)M[K++]=
0,S[0]++;else for(;0<x;)E=138>x?x:138,E>x-3&&E<x&&(E=x-3),10>=E?(M[K++]=17,M[K++]=E-3,S[17]++):(M[K++]=18,M[K++]=E-11,S[18]++),x-=E;else if(M[K++]=P[v],S[P[v]]++,x--,3>x)for(;0<x--;)M[K++]=P[v],S[P[v]]++;else for(;0<x;)E=6>x?x:6,E>x-3&&E<x&&(E=x-3),M[K++]=16,M[K++]=E-3,S[16]++,x-=E}e=H?M.subarray(0,K):M.slice(0,K);X=ua(S,7);for(D=0;19>D;D++)oa[D]=X[g[D]];for(C=19;4<C&&0===oa[C-1];C--);ya=va(X);A.b(N-257,5,y);A.b(B-1,5,y);A.b(C-4,4,y);for(D=0;D<C;D++)A.b(oa[D],3,y);D=0;for(za=e.length;D<za;D++)if(Z=
e[D],A.b(ya[Z],X[Z],y),16<=Z){D++;switch(Z){case 16:ia=2;break;case 17:ia=3;break;case 18:ia=7;break;default:throw"invalid code: "+Z;}A.b(e[D],ia,y)}var Ca=[ea,J],Da=[W,O],T,Ea,ga,ra,Fa,Ga,Ha,Ia;Fa=Ca[0];Ga=Ca[1];Ha=Da[0];Ia=Da[1];T=0;for(Ea=I.length;T<Ea;++T)if(ga=I[T],A.b(Fa[ga],Ga[ga],y),256<ga)A.b(I[++T],I[++T],y),ra=I[++T],A.b(Ha[ra],Ia[ra],y),A.b(I[++T],I[++T],y);else if(256===ga)break;this.c=A.finish();this.e=this.c.length;break;default:throw"invalid compression type";}return this.c};
function wa(e,b){this.length=e;this.n=b}
var xa=function(){function e(a){switch(y){case 3===a:return[257,a-3,0];case 4===a:return[258,a-4,0];case 5===a:return[259,a-5,0];case 6===a:return[260,a-6,0];case 7===a:return[261,a-7,0];case 8===a:return[262,a-8,0];case 9===a:return[263,a-9,0];case 10===a:return[264,a-10,0];case 12>=a:return[265,a-11,1];case 14>=a:return[266,a-13,1];case 16>=a:return[267,a-15,1];case 18>=a:return[268,a-17,1];case 22>=a:return[269,a-19,2];case 26>=a:return[270,a-23,2];case 30>=a:return[271,a-27,2];case 34>=a:return[272,
a-31,2];case 42>=a:return[273,a-35,3];case 50>=a:return[274,a-43,3];case 58>=a:return[275,a-51,3];case 66>=a:return[276,a-59,3];case 82>=a:return[277,a-67,4];case 98>=a:return[278,a-83,4];case 114>=a:return[279,a-99,4];case 130>=a:return[280,a-115,4];case 162>=a:return[281,a-131,5];case 194>=a:return[282,a-163,5];case 226>=a:return[283,a-195,5];case 257>=a:return[284,a-227,5];case 258===a:return[285,a-258,0];default:throw"invalid length: "+a;}}var b=[],a,d;for(a=3;258>=a;a++)d=e(a),b[a]=d[2]<<24|
d[1]<<16|d[0];return b}(),Ja=H?new Uint32Array(xa):xa;
function ta(e,b){function a(a,c){var b=a.n,d=[],e=0,f;f=Ja[a.length];d[e++]=f&65535;d[e++]=f>>16&255;d[e++]=f>>24;var g;switch(y){case 1===b:g=[0,b-1,0];break;case 2===b:g=[1,b-2,0];break;case 3===b:g=[2,b-3,0];break;case 4===b:g=[3,b-4,0];break;case 6>=b:g=[4,b-5,1];break;case 8>=b:g=[5,b-7,1];break;case 12>=b:g=[6,b-9,2];break;case 16>=b:g=[7,b-13,2];break;case 24>=b:g=[8,b-17,3];break;case 32>=b:g=[9,b-25,3];break;case 48>=b:g=[10,b-33,4];break;case 64>=b:g=[11,b-49,4];break;case 96>=b:g=[12,b-
65,5];break;case 128>=b:g=[13,b-97,5];break;case 192>=b:g=[14,b-129,6];break;case 256>=b:g=[15,b-193,6];break;case 384>=b:g=[16,b-257,7];break;case 512>=b:g=[17,b-385,7];break;case 768>=b:g=[18,b-513,8];break;case 1024>=b:g=[19,b-769,8];break;case 1536>=b:g=[20,b-1025,9];break;case 2048>=b:g=[21,b-1537,9];break;case 3072>=b:g=[22,b-2049,10];break;case 4096>=b:g=[23,b-3073,10];break;case 6144>=b:g=[24,b-4097,11];break;case 8192>=b:g=[25,b-6145,11];break;case 12288>=b:g=[26,b-8193,12];break;case 16384>=
b:g=[27,b-12289,12];break;case 24576>=b:g=[28,b-16385,13];break;case 32768>=b:g=[29,b-24577,13];break;default:throw"invalid distance";}f=g;d[e++]=f[0];d[e++]=f[1];d[e++]=f[2];var k,l;k=0;for(l=d.length;k<l;++k)m[h++]=d[k];t[d[0]]++;r[d[3]]++;s=a.length+c-1;u=null}var d,c,f,l,p,k={},q,w,u,m=H?new Uint16Array(2*b.length):[],h=0,s=0,t=new (H?Uint32Array:Array)(286),r=new (H?Uint32Array:Array)(30),Q=e.l,z;if(!H){for(f=0;285>=f;)t[f++]=0;for(f=0;29>=f;)r[f++]=0}t[256]=1;d=0;for(c=b.length;d<c;++d){f=p=
0;for(l=3;f<l&&d+f!==c;++f)p=p<<8|b[d+f];k[p]===n&&(k[p]=[]);q=k[p];if(!(0<s--)){for(;0<q.length&&32768<d-q[0];)q.shift();if(d+3>=c){u&&a(u,-1);f=0;for(l=c-d;f<l;++f)z=b[d+f],m[h++]=z,++t[z];break}0<q.length?(w=Ka(b,d,q),u?u.length<w.length?(z=b[d-1],m[h++]=z,++t[z],a(w,0)):a(u,-1):w.length<Q?u=w:a(w,0)):u?a(u,-1):(z=b[d],m[h++]=z,++t[z])}q.push(d)}m[h++]=256;t[256]++;e.p=t;e.o=r;return H?m.subarray(0,h):m}
function Ka(e,b,a){var d,c,f=0,l,p,k,q,w=e.length;p=0;q=a.length;a:for(;p<q;p++){d=a[q-p-1];l=3;if(3<f){for(k=f;3<k;k--)if(e[d+k-1]!==e[b+k-1])continue a;l=f}for(;258>l&&b+l<w&&e[d+l]===e[b+l];)++l;l>f&&(c=d,f=l);if(258===l)break}return new wa(f,b-c)}
function ua(e,b){var a=e.length,d=new na(572),c=new (H?Uint8Array:Array)(a),f,l,p,k,q;if(!H)for(k=0;k<a;k++)c[k]=0;for(k=0;k<a;++k)0<e[k]&&d.push(k,e[k]);f=Array(d.length/2);l=new (H?Uint32Array:Array)(d.length/2);if(1===f.length)return c[d.pop().index]=1,c;k=0;for(q=d.length/2;k<q;++k)f[k]=d.pop(),l[k]=f[k].value;p=La(l,l.length,b);k=0;for(q=f.length;k<q;++k)c[f[k].index]=p[k];return c}
function La(e,b,a){function d(a){var c=k[a][q[a]];c===b?(d(a+1),d(a+1)):--l[c];++q[a]}var c=new (H?Uint16Array:Array)(a),f=new (H?Uint8Array:Array)(a),l=new (H?Uint8Array:Array)(b),p=Array(a),k=Array(a),q=Array(a),w=(1<<a)-b,u=1<<a-1,m,h,s,t,r;c[a-1]=b;for(h=0;h<a;++h)w<u?f[h]=0:(f[h]=1,w-=u),w<<=1,c[a-2-h]=(c[a-1-h]/2|0)+b;c[0]=f[0];p[0]=Array(c[0]);k[0]=Array(c[0]);for(h=1;h<a;++h)c[h]>2*c[h-1]+f[h]&&(c[h]=2*c[h-1]+f[h]),p[h]=Array(c[h]),k[h]=Array(c[h]);for(m=0;m<b;++m)l[m]=a;for(s=0;s<c[a-1];++s)p[a-
1][s]=e[s],k[a-1][s]=s;for(m=0;m<a;++m)q[m]=0;1===f[a-1]&&(--l[0],++q[a-1]);for(h=a-2;0<=h;--h){t=m=0;r=q[h+1];for(s=0;s<c[h];s++)t=p[h+1][r]+p[h+1][r+1],t>e[m]?(p[h][s]=t,k[h][s]=b,r+=2):(p[h][s]=e[m],k[h][s]=m,++m);q[h]=0;1===f[h]&&d(h)}return l}
function va(e){var b=new (H?Uint16Array:Array)(e.length),a=[],d=[],c=0,f,l,p,k;f=0;for(l=e.length;f<l;f++)a[e[f]]=(a[e[f]]|0)+1;f=1;for(l=16;f<=l;f++)d[f]=c,c+=a[f]|0,c<<=1;f=0;for(l=e.length;f<l;f++){c=d[e[f]];d[e[f]]+=1;p=b[f]=0;for(k=e[f];p<k;p++)b[f]=b[f]<<1|c&1,c>>>=1}return b};function $(e){e=e||{};this.files=[];this.d=e.comment}var Ma=[80,75,1,2],Na=[80,75,3,4],Oa=[80,75,5,6];$.prototype.m=function(e,b){b=b||{};var a,d=e.length,c=0;H&&e instanceof Array&&(e=new Uint8Array(e));"number"!==typeof b.compressionMethod&&(b.compressionMethod=8);if(b.compress)switch(b.compressionMethod){case 0:break;case 8:c=la(e);e=(new pa(e,b.deflateOption)).g();a=y;break;default:throw Error("unknown compression method:"+b.compressionMethod);}this.files.push({buffer:e,a:b,j:a,r:!1,size:d,h:c})};
$.prototype.q=function(e){this.i=e};
$.prototype.g=function(){var e=this.files,b,a,d,c,f,l=0,p=0,k,q,w,u,m,h,s,t,r,Q,z,A,F,I,N,B,C,g,J;B=0;for(C=e.length;B<C;++B){b=e[B];t=b.a.filename?b.a.filename.length:0;r=b.a.comment?b.a.comment.length:0;if(!b.j)switch(b.h=la(b.buffer),b.a.compressionMethod){case 0:break;case 8:b.buffer=(new pa(b.buffer,b.a.deflateOption)).g();b.j=y;break;default:throw Error("unknown compression method:"+b.a.compressionMethod);}if(b.a.password!==n||this.i!==n){var ea=b.a.password||this.i,O=[305419896,591751049,878082192],
W=n,X=n;H&&(O=new Uint32Array(O));W=0;for(X=ea.length;W<X;++W)Pa(O,ea[W]&255);N=O;F=b.buffer;H?(I=new Uint8Array(F.length+12),I.set(F,12),F=I):F.unshift(0,0,0,0,0,0,0,0,0,0,0,0);for(g=0;12>g;++g)F[g]=Qa(N,11===B?b.h&255:256*Math.random()|0);for(J=F.length;g<J;++g)F[g]=Qa(N,F[g]);b.buffer=F}l+=30+t+b.buffer.length;p+=46+t+r}a=new (H?Uint8Array:Array)(l+p+(22+(this.d?this.d.length:0)));d=0;c=l;f=c+p;B=0;for(C=e.length;B<C;++B){b=e[B];t=b.a.filename?b.a.filename.length:0;r=b.a.comment?b.a.comment.length:
0;k=d;a[d++]=Na[0];a[d++]=Na[1];a[d++]=Na[2];a[d++]=Na[3];a[c++]=Ma[0];a[c++]=Ma[1];a[c++]=Ma[2];a[c++]=Ma[3];a[c++]=20;a[c++]=b.a.os||0;a[d++]=a[c++]=20;q=a[d++]=a[c++]=0;if(b.a.password||this.i)q|=1;a[d++]=a[c++]=q&255;a[d++]=a[c++]=q>>8&255;w=b.a.compressionMethod;a[d++]=a[c++]=w&255;a[d++]=a[c++]=w>>8&255;u=b.a.date||new Date;a[d++]=a[c++]=(u.getMinutes()&7)<<5|u.getSeconds()/2|0;a[d++]=a[c++]=u.getHours()<<3|u.getMinutes()>>3;a[d++]=a[c++]=(u.getMonth()+1&7)<<5|u.getDate();a[d++]=a[c++]=(u.getFullYear()-
1980&127)<<1|u.getMonth()+1>>3;m=b.h;a[d++]=a[c++]=m&255;a[d++]=a[c++]=m>>8&255;a[d++]=a[c++]=m>>16&255;a[d++]=a[c++]=m>>24&255;h=b.buffer.length;a[d++]=a[c++]=h&255;a[d++]=a[c++]=h>>8&255;a[d++]=a[c++]=h>>16&255;a[d++]=a[c++]=h>>24&255;s=b.size;a[d++]=a[c++]=s&255;a[d++]=a[c++]=s>>8&255;a[d++]=a[c++]=s>>16&255;a[d++]=a[c++]=s>>24&255;a[d++]=a[c++]=t&255;a[d++]=a[c++]=t>>8&255;a[d++]=a[c++]=0;a[d++]=a[c++]=0;a[c++]=r&255;a[c++]=r>>8&255;a[c++]=0;a[c++]=0;a[c++]=0;a[c++]=0;a[c++]=0;a[c++]=0;a[c++]=
0;a[c++]=0;a[c++]=k&255;a[c++]=k>>8&255;a[c++]=k>>16&255;a[c++]=k>>24&255;if(Q=b.a.filename)if(H)a.set(Q,d),a.set(Q,c),d+=t,c+=t;else for(g=0;g<t;++g)a[d++]=a[c++]=Q[g];if(z=b.a.extraField)if(H)a.set(z,d),a.set(z,c),d+=0,c+=0;else for(g=0;g<r;++g)a[d++]=a[c++]=z[g];if(A=b.a.comment)if(H)a.set(A,c),c+=r;else for(g=0;g<r;++g)a[c++]=A[g];if(H)a.set(b.buffer,d),d+=b.buffer.length;else{g=0;for(J=b.buffer.length;g<J;++g)a[d++]=b.buffer[g]}}a[f++]=Oa[0];a[f++]=Oa[1];a[f++]=Oa[2];a[f++]=Oa[3];a[f++]=0;a[f++]=
0;a[f++]=0;a[f++]=0;a[f++]=C&255;a[f++]=C>>8&255;a[f++]=C&255;a[f++]=C>>8&255;a[f++]=p&255;a[f++]=p>>8&255;a[f++]=p>>16&255;a[f++]=p>>24&255;a[f++]=l&255;a[f++]=l>>8&255;a[f++]=l>>16&255;a[f++]=l>>24&255;r=this.d?this.d.length:0;a[f++]=r&255;a[f++]=r>>8&255;if(this.d)if(H)a.set(this.d,f);else{g=0;for(J=r;g<J;++g)a[f++]=this.d[g]}return a};function Qa(e,b){var a,d=e[2]&65535|2;a=d*(d^1)>>8&255;Pa(e,b);return a^b}
function Pa(e,b){e[0]=(V[(e[0]^b)&255]^e[0]>>>8)>>>0;e[1]=(6681*(20173*(e[1]+(e[0]&255))>>>0)>>>0)+1>>>0;e[2]=(V[(e[2]^e[1]>>>24)&255]^e[2]>>>8)>>>0};function Ra(e,b){var a,d,c,f;if(Object.keys)a=Object.keys(b);else for(d in a=[],c=0,b)a[c++]=d;c=0;for(f=a.length;c<f;++c)d=a[c],G(e+"."+d,b[d])};G("Zlib.Zip",$);G("Zlib.Zip.prototype.addFile",$.prototype.m);G("Zlib.Zip.prototype.compress",$.prototype.g);G("Zlib.Zip.prototype.setPassword",$.prototype.q);Ra("Zlib.Zip.CompressionMethod",{STORE:0,DEFLATE:8});Ra("Zlib.Zip.OperatingSystem",{MSDOS:0,UNIX:3,MACINTOSH:7});}).call(this,CRC32Table);
(function(C){'use strict';function l(a){throw a;}var r=void 0,t,aa=this;function v(a,b){var c=a.split("."),d=aa;!(c[0]in d)&&d.execScript&&d.execScript("var "+c[0]);for(var f;c.length&&(f=c.shift());)!c.length&&b!==r?d[f]=b:d=d[f]?d[f]:d[f]={}};var y="undefined"!==typeof Uint8Array&&"undefined"!==typeof Uint16Array&&"undefined"!==typeof Uint32Array&&"undefined"!==typeof DataView;new (y?Uint8Array:Array)(256);var z;for(z=0;256>z;++z)for(var B=z,ba=7,B=B>>>1;B;B>>>=1)--ba;if(aa.Uint8Array!==r)try{eval("String.fromCharCode.apply(null, new Uint8Array([0]));")}catch(ea){String.fromCharCode.apply=function(a){return function(b,c){return a.call(String.fromCharCode,b,Array.prototype.slice.call(c))}}(String.fromCharCode.apply)};function D(a){var b=a.length,c=0,d=Number.POSITIVE_INFINITY,f,h,k,e,g,m,p,s,q,x;for(s=0;s<b;++s)a[s]>c&&(c=a[s]),a[s]<d&&(d=a[s]);f=1<<c;h=new (y?Uint32Array:Array)(f);k=1;e=0;for(g=2;k<=c;){for(s=0;s<b;++s)if(a[s]===k){m=0;p=e;for(q=0;q<k;++q)m=m<<1|p&1,p>>=1;x=k<<16|s;for(q=m;q<f;q+=g)h[q]=x;++e}++k;e<<=1;g<<=1}return[h,c,d]};var F=[],G;for(G=0;288>G;G++)switch(!0){case 143>=G:F.push([G+48,8]);break;case 255>=G:F.push([G-144+400,9]);break;case 279>=G:F.push([G-256+0,7]);break;case 287>=G:F.push([G-280+192,8]);break;default:l("invalid literal: "+G)}
var fa=function(){function a(a){switch(!0){case 3===a:return[257,a-3,0];case 4===a:return[258,a-4,0];case 5===a:return[259,a-5,0];case 6===a:return[260,a-6,0];case 7===a:return[261,a-7,0];case 8===a:return[262,a-8,0];case 9===a:return[263,a-9,0];case 10===a:return[264,a-10,0];case 12>=a:return[265,a-11,1];case 14>=a:return[266,a-13,1];case 16>=a:return[267,a-15,1];case 18>=a:return[268,a-17,1];case 22>=a:return[269,a-19,2];case 26>=a:return[270,a-23,2];case 30>=a:return[271,a-27,2];case 34>=a:return[272,
a-31,2];case 42>=a:return[273,a-35,3];case 50>=a:return[274,a-43,3];case 58>=a:return[275,a-51,3];case 66>=a:return[276,a-59,3];case 82>=a:return[277,a-67,4];case 98>=a:return[278,a-83,4];case 114>=a:return[279,a-99,4];case 130>=a:return[280,a-115,4];case 162>=a:return[281,a-131,5];case 194>=a:return[282,a-163,5];case 226>=a:return[283,a-195,5];case 257>=a:return[284,a-227,5];case 258===a:return[285,a-258,0];default:l("invalid length: "+a)}}var b=[],c,d;for(c=3;258>=c;c++)d=a(c),b[c]=d[2]<<24|d[1]<<
16|d[0];return b}();y&&new Uint32Array(fa);function I(a,b){this.l=[];this.m=32768;this.d=this.f=this.c=this.t=0;this.input=y?new Uint8Array(a):a;this.u=!1;this.n=J;this.K=!1;if(b||!(b={}))b.index&&(this.c=b.index),b.bufferSize&&(this.m=b.bufferSize),b.bufferType&&(this.n=b.bufferType),b.resize&&(this.K=b.resize);switch(this.n){case ga:this.a=32768;this.b=new (y?Uint8Array:Array)(32768+this.m+258);break;case J:this.a=0;this.b=new (y?Uint8Array:Array)(this.m);this.e=this.W;this.B=this.R;this.q=this.V;break;default:l(Error("invalid inflate mode"))}}
var ga=0,J=1;
I.prototype.r=function(){for(;!this.u;){var a=K(this,3);a&1&&(this.u=!0);a>>>=1;switch(a){case 0:var b=this.input,c=this.c,d=this.b,f=this.a,h=b.length,k=r,e=r,g=d.length,m=r;this.d=this.f=0;c+1>=h&&l(Error("invalid uncompressed block header: LEN"));k=b[c++]|b[c++]<<8;c+1>=h&&l(Error("invalid uncompressed block header: NLEN"));e=b[c++]|b[c++]<<8;k===~e&&l(Error("invalid uncompressed block header: length verify"));c+k>b.length&&l(Error("input buffer is broken"));switch(this.n){case ga:for(;f+k>d.length;){m=
g-f;k-=m;if(y)d.set(b.subarray(c,c+m),f),f+=m,c+=m;else for(;m--;)d[f++]=b[c++];this.a=f;d=this.e();f=this.a}break;case J:for(;f+k>d.length;)d=this.e({H:2});break;default:l(Error("invalid inflate mode"))}if(y)d.set(b.subarray(c,c+k),f),f+=k,c+=k;else for(;k--;)d[f++]=b[c++];this.c=c;this.a=f;this.b=d;break;case 1:this.q(ha,ia);break;case 2:for(var p=K(this,5)+257,s=K(this,5)+1,q=K(this,4)+4,x=new (y?Uint8Array:Array)(L.length),u=r,n=r,E=r,A=r,X=r,O=r,H=r,w=r,da=r,w=0;w<q;++w)x[L[w]]=K(this,3);if(!y){w=
q;for(q=x.length;w<q;++w)x[L[w]]=0}u=D(x);A=new (y?Uint8Array:Array)(p+s);w=0;for(da=p+s;w<da;)switch(X=M(this,u),X){case 16:for(H=3+K(this,2);H--;)A[w++]=O;break;case 17:for(H=3+K(this,3);H--;)A[w++]=0;O=0;break;case 18:for(H=11+K(this,7);H--;)A[w++]=0;O=0;break;default:O=A[w++]=X}n=y?D(A.subarray(0,p)):D(A.slice(0,p));E=y?D(A.subarray(p)):D(A.slice(p));this.q(n,E);break;default:l(Error("unknown BTYPE: "+a))}}return this.B()};
var ja=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15],L=y?new Uint16Array(ja):ja,ka=[3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258,258,258],la=y?new Uint16Array(ka):ka,ma=[0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0],N=y?new Uint8Array(ma):ma,na=[1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577],oa=y?new Uint16Array(na):na,pa=[0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,
11,11,12,12,13,13],P=y?new Uint8Array(pa):pa,Q=new (y?Uint8Array:Array)(288),R,qa;R=0;for(qa=Q.length;R<qa;++R)Q[R]=143>=R?8:255>=R?9:279>=R?7:8;var ha=D(Q),S=new (y?Uint8Array:Array)(30),T,ra;T=0;for(ra=S.length;T<ra;++T)S[T]=5;var ia=D(S);function K(a,b){for(var c=a.f,d=a.d,f=a.input,h=a.c,k=f.length,e;d<b;)h>=k&&l(Error("input buffer is broken")),c|=f[h++]<<d,d+=8;e=c&(1<<b)-1;a.f=c>>>b;a.d=d-b;a.c=h;return e}
function M(a,b){for(var c=a.f,d=a.d,f=a.input,h=a.c,k=f.length,e=b[0],g=b[1],m,p;d<g&&!(h>=k);)c|=f[h++]<<d,d+=8;m=e[c&(1<<g)-1];p=m>>>16;p>d&&l(Error("invalid code length: "+p));a.f=c>>p;a.d=d-p;a.c=h;return m&65535}t=I.prototype;
t.q=function(a,b){var c=this.b,d=this.a;this.C=a;for(var f=c.length-258,h,k,e,g;256!==(h=M(this,a));)if(256>h)d>=f&&(this.a=d,c=this.e(),d=this.a),c[d++]=h;else{k=h-257;g=la[k];0<N[k]&&(g+=K(this,N[k]));h=M(this,b);e=oa[h];0<P[h]&&(e+=K(this,P[h]));d>=f&&(this.a=d,c=this.e(),d=this.a);for(;g--;)c[d]=c[d++-e]}for(;8<=this.d;)this.d-=8,this.c--;this.a=d};
t.V=function(a,b){var c=this.b,d=this.a;this.C=a;for(var f=c.length,h,k,e,g;256!==(h=M(this,a));)if(256>h)d>=f&&(c=this.e(),f=c.length),c[d++]=h;else{k=h-257;g=la[k];0<N[k]&&(g+=K(this,N[k]));h=M(this,b);e=oa[h];0<P[h]&&(e+=K(this,P[h]));d+g>f&&(c=this.e(),f=c.length);for(;g--;)c[d]=c[d++-e]}for(;8<=this.d;)this.d-=8,this.c--;this.a=d};
t.e=function(){var a=new (y?Uint8Array:Array)(this.a-32768),b=this.a-32768,c,d,f=this.b;if(y)a.set(f.subarray(32768,a.length));else{c=0;for(d=a.length;c<d;++c)a[c]=f[c+32768]}this.l.push(a);this.t+=a.length;if(y)f.set(f.subarray(b,b+32768));else for(c=0;32768>c;++c)f[c]=f[b+c];this.a=32768;return f};
t.W=function(a){var b,c=this.input.length/this.c+1|0,d,f,h,k=this.input,e=this.b;a&&("number"===typeof a.H&&(c=a.H),"number"===typeof a.P&&(c+=a.P));2>c?(d=(k.length-this.c)/this.C[2],h=258*(d/2)|0,f=h<e.length?e.length+h:e.length<<1):f=e.length*c;y?(b=new Uint8Array(f),b.set(e)):b=e;return this.b=b};
t.B=function(){var a=0,b=this.b,c=this.l,d,f=new (y?Uint8Array:Array)(this.t+(this.a-32768)),h,k,e,g;if(0===c.length)return y?this.b.subarray(32768,this.a):this.b.slice(32768,this.a);h=0;for(k=c.length;h<k;++h){d=c[h];e=0;for(g=d.length;e<g;++e)f[a++]=d[e]}h=32768;for(k=this.a;h<k;++h)f[a++]=b[h];this.l=[];return this.buffer=f};
t.R=function(){var a,b=this.a;y?this.K?(a=new Uint8Array(b),a.set(this.b.subarray(0,b))):a=this.b.subarray(0,b):(this.b.length>b&&(this.b.length=b),a=this.b);return this.buffer=a};function U(a){a=a||{};this.files=[];this.v=a.comment}U.prototype.L=function(a){this.j=a};U.prototype.s=function(a){var b=a[2]&65535|2;return b*(b^1)>>8&255};U.prototype.k=function(a,b){a[0]=(C[(a[0]^b)&255]^a[0]>>>8)>>>0;a[1]=(6681*(20173*(a[1]+(a[0]&255))>>>0)>>>0)+1>>>0;a[2]=(C[(a[2]^a[1]>>>24)&255]^a[2]>>>8)>>>0};U.prototype.T=function(a){var b=[305419896,591751049,878082192],c,d;y&&(b=new Uint32Array(b));c=0;for(d=a.length;c<d;++c)this.k(b,a[c]&255);return b};function V(a,b){b=b||{};this.input=y&&a instanceof Array?new Uint8Array(a):a;this.c=0;this.ba=b.verify||!1;this.j=b.password}var sa={O:0,M:8},W=[80,75,1,2],Y=[80,75,3,4],Z=[80,75,5,6];function ta(a,b){this.input=a;this.offset=b}
ta.prototype.parse=function(){var a=this.input,b=this.offset;(a[b++]!==W[0]||a[b++]!==W[1]||a[b++]!==W[2]||a[b++]!==W[3])&&l(Error("invalid file header signature"));this.version=a[b++];this.ia=a[b++];this.Z=a[b++]|a[b++]<<8;this.I=a[b++]|a[b++]<<8;this.A=a[b++]|a[b++]<<8;this.time=a[b++]|a[b++]<<8;this.U=a[b++]|a[b++]<<8;this.p=(a[b++]|a[b++]<<8|a[b++]<<16|a[b++]<<24)>>>0;this.z=(a[b++]|a[b++]<<8|a[b++]<<16|a[b++]<<24)>>>0;this.J=(a[b++]|a[b++]<<8|a[b++]<<16|a[b++]<<24)>>>0;this.h=a[b++]|a[b++]<<
8;this.g=a[b++]|a[b++]<<8;this.F=a[b++]|a[b++]<<8;this.ea=a[b++]|a[b++]<<8;this.ga=a[b++]|a[b++]<<8;this.fa=a[b++]|a[b++]<<8|a[b++]<<16|a[b++]<<24;this.$=(a[b++]|a[b++]<<8|a[b++]<<16|a[b++]<<24)>>>0;this.filename=String.fromCharCode.apply(null,y?a.subarray(b,b+=this.h):a.slice(b,b+=this.h));this.X=y?a.subarray(b,b+=this.g):a.slice(b,b+=this.g);this.v=y?a.subarray(b,b+this.F):a.slice(b,b+this.F);this.length=b-this.offset};function ua(a,b){this.input=a;this.offset=b}var va={N:1,ca:8,da:2048};
ua.prototype.parse=function(){var a=this.input,b=this.offset;(a[b++]!==Y[0]||a[b++]!==Y[1]||a[b++]!==Y[2]||a[b++]!==Y[3])&&l(Error("invalid local file header signature"));this.Z=a[b++]|a[b++]<<8;this.I=a[b++]|a[b++]<<8;this.A=a[b++]|a[b++]<<8;this.time=a[b++]|a[b++]<<8;this.U=a[b++]|a[b++]<<8;this.p=(a[b++]|a[b++]<<8|a[b++]<<16|a[b++]<<24)>>>0;this.z=(a[b++]|a[b++]<<8|a[b++]<<16|a[b++]<<24)>>>0;this.J=(a[b++]|a[b++]<<8|a[b++]<<16|a[b++]<<24)>>>0;this.h=a[b++]|a[b++]<<8;this.g=a[b++]|a[b++]<<8;this.filename=
String.fromCharCode.apply(null,y?a.subarray(b,b+=this.h):a.slice(b,b+=this.h));this.X=y?a.subarray(b,b+=this.g):a.slice(b,b+=this.g);this.length=b-this.offset};
function $(a){var b=[],c={},d,f,h,k;if(!a.i){if(a.o===r){var e=a.input,g;if(!a.D)a:{var m=a.input,p;for(p=m.length-12;0<p;--p)if(m[p]===Z[0]&&m[p+1]===Z[1]&&m[p+2]===Z[2]&&m[p+3]===Z[3]){a.D=p;break a}l(Error("End of Central Directory Record not found"))}g=a.D;(e[g++]!==Z[0]||e[g++]!==Z[1]||e[g++]!==Z[2]||e[g++]!==Z[3])&&l(Error("invalid signature"));a.ha=e[g++]|e[g++]<<8;a.ja=e[g++]|e[g++]<<8;a.ka=e[g++]|e[g++]<<8;a.aa=e[g++]|e[g++]<<8;a.Q=(e[g++]|e[g++]<<8|e[g++]<<16|e[g++]<<24)>>>0;a.o=(e[g++]|
e[g++]<<8|e[g++]<<16|e[g++]<<24)>>>0;a.w=e[g++]|e[g++]<<8;a.v=y?e.subarray(g,g+a.w):e.slice(g,g+a.w)}d=a.o;h=0;for(k=a.aa;h<k;++h)f=new ta(a.input,d),f.parse(),d+=f.length,b[h]=f,c[f.filename]=h;a.Q<d-a.o&&l(Error("invalid file header size"));a.i=b;a.G=c}}t=V.prototype;t.Y=function(){var a=[],b,c,d;this.i||$(this);d=this.i;b=0;for(c=d.length;b<c;++b)a[b]=d[b].filename;return a};
t.r=function(a,b){var c;this.G||$(this);c=this.G[a];c===r&&l(Error(a+" not found"));var d;d=b||{};var f=this.input,h=this.i,k,e,g,m,p,s,q,x;h||$(this);h[c]===r&&l(Error("wrong index"));e=h[c].$;k=new ua(this.input,e);k.parse();e+=k.length;g=k.z;if(0!==(k.I&va.N)){!d.password&&!this.j&&l(Error("please set password"));s=this.S(d.password||this.j);q=e;for(x=e+12;q<x;++q)wa(this,s,f[q]);e+=12;g-=12;q=e;for(x=e+g;q<x;++q)f[q]=wa(this,s,f[q])}switch(k.A){case sa.O:m=y?this.input.subarray(e,e+g):this.input.slice(e,
e+g);break;case sa.M:m=(new I(this.input,{index:e,bufferSize:k.J})).r();break;default:l(Error("unknown compression type"))}if(this.ba){var u=r,n,E="number"===typeof u?u:u=0,A=m.length;n=-1;for(E=A&7;E--;++u)n=n>>>8^C[(n^m[u])&255];for(E=A>>3;E--;u+=8)n=n>>>8^C[(n^m[u])&255],n=n>>>8^C[(n^m[u+1])&255],n=n>>>8^C[(n^m[u+2])&255],n=n>>>8^C[(n^m[u+3])&255],n=n>>>8^C[(n^m[u+4])&255],n=n>>>8^C[(n^m[u+5])&255],n=n>>>8^C[(n^m[u+6])&255],n=n>>>8^C[(n^m[u+7])&255];p=(n^4294967295)>>>0;k.p!==p&&l(Error("wrong crc: file=0x"+
k.p.toString(16)+", data=0x"+p.toString(16)))}return m};t.L=function(a){this.j=a};function wa(a,b,c){c^=a.s(b);a.k(b,c);return c}t.k=U.prototype.k;t.S=U.prototype.T;t.s=U.prototype.s;v("Zlib.Unzip",V);v("Zlib.Unzip.prototype.decompress",V.prototype.r);v("Zlib.Unzip.prototype.getFilenames",V.prototype.Y);v("Zlib.Unzip.prototype.setPassword",V.prototype.L);}).call(this,CRC32Table);
}).call(this);

})();

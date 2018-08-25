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

(function() {

var $ = function(i) { return document.getElementById(i); };
var TXT =
{
	LOAD:    'Loading Engine',
	PARSE:   'Preparing',
	EXECUTE: 'Starting',
	DLERROR: 'Error while downloading engine data, check your internet connection.',
	NOWEBGL: 'Your browser or graphics card does not seem to support <a href="http://khronos.org/webgl/wiki/Getting_a_WebGL_Implementation" style="color:#000">WebGL</a>.<br>Find out how to get it <a href="http://get.webgl.org/" style="color:#000">here</a>.',
};
var file = $('file'), code = $('code'), run = $('run'), pause = $('pause'), fullscreen = $('fullscreen'), frame = $('frame'), fw, gametitle = $('gametitle'), canvas = $('canvas'), ctx, log = $('log');
run.disabled = false;
var Msg = function(m)
{
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	ctx.fillStyle = '#888';
	for (var i = 0, a = m.split('\n'), n = a.length; i != n; i++)
		ctx.fillText(a[i], canvas.width/2, canvas.height/2-(n-1)*20+10+i*40);
};
var Log = function(m)
{
	var d = document.createElement('div');
	d.style.paddingTop = '5px';
	d.innerHTML = m;
	log.appendChild(d);
	log.scrollTop = 9999999;
};
var Cleanup = function(enableRun, clearFrame)
{
	if (fw) { try { fw.Module.noExitRuntime = 0; fw.exit(); }catch(ex){} fw = null; }
	if (clearFrame) (frame.srcdoc === undefined ? frame.src = 'javascript:"<html></html>"' : frame.srcdoc = '<html></html>');
	canvas.blur();
	canvas.removeAttribute('tabIndex');
	pause.textContent = 'Pause';
	pause.disabled = fullscreen.disabled = true;
	run.disabled = !enableRun;
}
var Abort = function(m)
{
	if (ctx) { Msg('Error'); ctx = null; }
	console.log(m);
	Log(m);
	Cleanup(1, 1);
};
run.onclick = function()
{
	run.blur();
	Cleanup(0, 0);
	var c = canvas.cloneNode(false); canvas.parentNode.replaceChild(c, canvas); canvas = c;
	canvas.oncontextmenu = function(e) { e.preventDefault() };
	ctx = canvas.getContext('2d');
	ctx.font = '30px sans-serif';
	ctx.textAlign = 'center';
	ctx.pCnt = 0;
	canvas.parentNode.style.display = null;
	gametitle.innerText = '. . . . .';
	gametitle.scrollIntoView();
	Msg(TXT.LOAD);
	Cleanup(0, 1);
};
var DoExecute = function(arg)
{
	if (!window.requestAnimationFrame) { var w = window, n = 'equestAnimationFrame'; w.requestAnimationFrame = w['r'+n] || w['mozR'+n] || w['webkitR'+n] || w['msR'+n] || w['oR'+n]; }
	fw.Module.print = Log;
	fw.Module.canvas = canvas.cloneNode(false);
	fw.Module.canvas.oncontextmenu = function(e) { e.preventDefault() };
	fw.Module.setWindowTitle = function(t) { gametitle.innerText = t||'-'; };
	fw.Browser.resizeListeners = [function(w, h) { gametitle.scrollIntoView(); run.disabled = pause.disabled = fullscreen.disabled = false; }];
	fw.Browser.requestAnimationFrame = function(f) { window.requestAnimationFrame(f); }
	fw.Browser.mainLoop.realpause = fw.Browser.mainLoop.pause;
	fw.Browser.mainLoop.pause = function() { fw.Browser.mainLoop.realpause(); gametitle.innerText = 'Quit'; Abort('Game was quit') }
	fw.abortDecorators = [function(o, what)
	{
		//On insufficient memory aborts remove runtime exit callbacks because they could cause infinite loops
		if (what.indexOf('memory') > 0) for (var a = fw.__ATEXIT__, i = a.length; i--;) if (typeof a[i] != 'function') a.splice(i,1);
		gametitle.innerText = 'Crashed';
		Abort('Aborted')
	}];
	fw.JSEvents.findEventTarget = function(t)
	{
		////Use this to log all event listener registrations
		//try{throw Error(1)}catch(ex){Log('Event on: '+(t == fw ? 'fw window' : (t == fw.document ? 'fw document' : (t == fw.screen ? 'fw screen' : (t == window ? 'my window' : (t == document ? 'my document' : (t == screen ? 'my screen' : (t == fw.Module.canvas ? 'canvas' : t)))))))+((typeof t == 'number') ? ' ('+fw.Pointer_stringify(t)+')' : '')+' ]] '+ex.stack);}
		if (typeof t == 'number') t = fw.Pointer_stringify(t);
		if (t == fw) return window;
		if (t == '#document' || t == fw.document) return document;
		if (t == '#screen' || t == fw.screen) return screen;
		if (t == '#window' || t == '#canvas') return canvas; //no global key events, only on canvas
		if (typeof t != 'string') return t;
		Log('Error: Unknown event target: ' + t);
	};
	fw.Module.postRun = function()
	{
		if (!fw.Module.noExitRuntime) { Abort(TXT.NOWEBGL); return; }
		ctx = null;
		canvas.parentNode.replaceChild(fw.Module.canvas, canvas);
		canvas = fw.Module.canvas;
		canvas.tabIndex = 0;
		canvas.focus();
		canvas.addEventListener('keydown', function(e) { e.preventDefault(); if (e.keyCode == 27) e.target.blur(); });
		canvas.addEventListener('click', function(e) { if (document.activeElement != e.target) { e.target.focus(); gametitle.scrollIntoView() } });
	};
	Msg(TXT.EXECUTE);
	setTimeout(function() { fw.Module.run([arg]); }, 50);
};
frame.onload = function()
{
	if (!ctx) return;
	fw = frame.contentWindow;
	var xhr = new XMLHttpRequest();
	xhr.open('GET', 'love.js');
	xhr.onprogress = function(e)
	{
		if (!e.lengthComputable || ctx.pCnt++ < 5) return;
		var x = canvas.width/2-150, y = canvas.height*.6, w = Math.min(e.loaded/e.total,1)*300, g = ctx.createLinearGradient(x,0,x+w,0);
		g.addColorStop(0,'#72d3ff');g.addColorStop(1,'#a2d4ea');
		ctx.fillStyle = '#1497ce'; ctx.fillRect(x-2,y-2,304,28);
		ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x  ,y  ,300,24);
		ctx.fillStyle = g;         ctx.fillRect(x  ,y  ,w,  24);
	};
	xhr.onerror = xhr.onabort = function() { Abort(TXT.DLERROR); };
	xhr.onload = function()
	{
		if (xhr.status != 200) { Abort(TXT.DLERROR + ' Status: ' + xhr.statusText); return; }
		Msg(TXT.PARSE);
		setTimeout(function()
		{
			Log('Starting...');
			fw.Module = { TOTAL_MEMORY: 1048576*($('memory').value*1||24), TOTAL_STACK: 1048576*($('stack').value*1||2), currentScriptUrl: '-' };
			var s = fw.document.createElement('script'), de = fw.document.documentElement;
			s.textContent = xhr.response;
			de.appendChild(s);
			de.removeChild(s);
			xhr = s = de = xhr.response = s.textContent = null;
			if (!fw.shouldRunNow) { Abort('Unknown startup error, check developer console (F12)'); return; }
			if (code)
			{
				code.AddSampleAssetFiles(fw.FS);
				fw.FS.createDataFile('/main.lua',0,code.value,!0,!0,!0);
				DoExecute('/');
			}
			else if (file && file.files.length)
			{
				var GetFile = function(i)
				{
					var reader = new FileReader();
					reader.onloadend = function(e)
					{
						var r = e.target.result;
						var IsOne = (file.files.length == 1), IsZip = (IsOne && r.byteLength >= 4 && (new Uint32Array(r, 0, 1))[0] == 67324752), IsLua = (IsOne && !IsZip);
						if (i == 0 && !IsLua && !IsZip) fw.FS.mkdir('/l');
						fw.FS.createDataFile((IsZip ? '/p' : (IsLua ? '/main.lua' : '/l/'+file.files[i].name)),0,new Uint8Array(r),!0,!0,!0);
						if (++i != file.files.length) { GetFile(i); return; }
						DoExecute(IsZip ? '/p' : (IsLua ? '/' : '/l'));
					};
					reader.readAsArrayBuffer(file.files[i]);
				};
				GetFile(0);
			}
			else DoExecute('/p');
		},50);
	};
	xhr.send();
};
pause.onclick = function()
{
	var l = fw.Browser.mainLoop;
	if (l.scheduler) { fw.Browser.mainLoop.realpause(); canvas.removeAttribute('tabIndex'); pause.textContent = 'Continue'; }
	else { fw.Browser.mainLoop.resume(); canvas.tabIndex = 0; canvas.focus(); pause.textContent = 'Pause'; }
};
fullscreen.onclick = function()
{
	var fs = canvas['requestFullscreen'] || canvas['mozRequestFullscreen'] || canvas['mozRequestFullScreen'] || (canvas['webkitRequestFullScreen'] ? function() { canvas['webkitRequestFullScreen'](1) } : null);
	if (fs) fs.apply(canvas, []);
	canvas.focus();
};
$('clearlog').onclick = function()
{
	log.innerHTML = null;
};
if (code)
{
	code.onkeydown = function(e)
	{
		if (e.keyCode === 9) { e.preventDefault(); if(!document.execCommand('insertText',false,'\t')){var t=this,v=t.value,s=t.selectionStart,n=t.selectionEnd;t.value=v.substring(0,s)+'\t'+v.substring(n);t.selectionStart=t.selectionEnd=s+1} }
		if (e.keyCode === 13 && e.ctrlKey) { e.preventDefault(); run.click(); }
	};
}

})();

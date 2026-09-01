var background = document.getElementsByClassName("background")[0];
var titlebg = document.getElementsByClassName("title-bg")[0];
var waitloads = document.getElementsByClassName("waitload");

var mobiles = document.getElementsByClassName("mobile");
var c90s = document.getElementsByClassName("c90");
var c92s = document.getElementsByClassName("c92");

var mobile_tab = document.getElementsByClassName("mobile-tab")[0];
var c90_tab = document.getElementsByClassName("c90-tab")[0];
var c92_tab = document.getElementsByClassName("c92-tab")[0];
function set_waitload(state)
{
    for(var i=0; i<waitloads.length; i++)
    {
        var element = waitloads[i] ;
        element.style.display = state;
    }
}
function set_mobile(state)
{
	for(var i=0; i<mobiles.length; i++)
	{
		var element = mobiles[i] ;
		element.style.display = state;
	}
}
function set_c90(state)
{
	for(var i=0; i<c90s.length; i++)
	{
		var element = c90s[i] ;
		element.style.display = state;
	}
}
function set_c92(state)
{
	for(var i=0; i<c92s.length; i++)
	{
		var element = c92s[i] ;
		element.style.display = state;
	}
}
function toggle_mobile()
{
	set_mobile("block");
    set_c90("none");
	set_c92("none");
	mobile_tab.classList.add('tab-select');
	c90_tab.classList.remove('tab-select');
	c92_tab.classList.remove('tab-select');
    titlebg.className = "title-bg-03"
    background.className = "background-02"
}
function toggle_c90()
{
	set_mobile("none");
	set_c90("block");
    set_c92("none");
	mobile_tab.classList.remove('tab-select');
	c90_tab.classList.add('tab-select');
	c92_tab.classList.remove('tab-select');
    titlebg.className = "title-bg-01"
    background.className = "background-01"
}
function toggle_c92()
{
	set_mobile("none");
    set_c90("none");
	set_c92("block");
	mobile_tab.classList.remove('tab-select');
	c90_tab.classList.remove('tab-select');
	c92_tab.classList.add('tab-select');
    titlebg.className = "title-bg-02"
    background.className = "background-02"
}
function getUrlParams() {
	var params = {};
	// window.location.search で URL の ? 以降の文字列を取得
	// ? を含むため 1 文字目は外す
	var query = window.location.search.substring(1);
	// & で分割
	var vars = query.split('&');
	for (var i = 0; i < vars.length; i++) {
		// = で分割
		var tmp = vars[i].split('=');
		params[tmp[0]] = tmp[1];
	}
	return params;
}

// --- 表示言語(日本語 / 英語) ---------------------------------------------
// 訳は日英の2本。?lang= が来ていればそれに従い、無ければブラウザの言語で決める。
// アプリのプライバシーポリシーと同じ考え方で、ja 以外はすべて英語で見せる。
var SITE_TITLE = { ja: "ありすのステージ", en: "Stage of Arisu" };
var LANG_LABEL = { ja: "English", en: "日本語" };
var current_lang = "ja";

function render_lang(lang)
{
	var nodes = document.querySelectorAll('[data-' + lang + ']');
	for (var i = 0; i < nodes.length; i++)
	{
		var text = nodes[i].getAttribute('data-' + lang);
		if (text == null) continue;
		// data-* にはリンクや <br /> をエンティティで入れているので innerHTML で戻す
		nodes[i].innerHTML = text;
	}
	document.documentElement.setAttribute('lang', lang);
	document.title = SITE_TITLE[lang];
	var button = document.getElementById('langToggle');
	if (button)
	{
		button.textContent = LANG_LABEL[lang];
		// ボタンの文字は「切り替え先」なので、説明も切り替え先の言語で書く
		button.setAttribute('lang', lang === 'ja' ? 'en' : 'ja');
		button.setAttribute('aria-label', lang === 'ja' ? 'Switch to English' : '日本語に切り替える');
	}
	current_lang = lang;
}

function initial_lang(params)
{
	var requested = (params["lang"] || '').toLowerCase();
	if (requested !== '') return (requested === 'ja') ? 'ja' : 'en';
	var browser = (navigator.language || 'ja').toLowerCase();
	return (browser.indexOf('ja') === 0) ? 'ja' : 'en';
}

function setup_lang_toggle(params)
{
	render_lang(initial_lang(params));
	var button = document.getElementById('langToggle');
	if (!button) return;
	button.addEventListener('click', function ()
	{
		render_lang(current_lang === 'ja' ? 'en' : 'ja');
		// 共有したリンクでも同じ言語で開けるよう URL を書き換える
		var query = new URLSearchParams(window.location.search);
		query.set('lang', current_lang);
		history.replaceState(null, '', window.location.pathname + '?' + query.toString());
	});
}

window.onload = function()
{
	var params = getUrlParams();
	setup_lang_toggle(params);
	var target = params["tab"];
	switch (target)
	{
		case "c90": toggle_c90(); break;
		case "c92": toggle_c92(); break;
		default:
		case "mobile": toggle_mobile(); break;
	}
    set_waitload("none");
};
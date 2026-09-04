var background = document.getElementsByClassName("background")[0];
var titlebg = document.getElementsByClassName("title-bg")[0];
var waitloads = document.getElementsByClassName("waitload");

// タブごとの表示グループ。要素は class 名で束ね、タブは "<name>-tab" のボタン。
// 1 つの要素が複数のタブに属してもよい(ストアリンクは mobile と kimagure の両方に出す)
var TABS = {
	kimagure: { titlebg: "title-bg-03", background: "background-02" },	// 3系(きまぐれリプライズ、2026)
	mobile:   { titlebg: "title-bg-03", background: "background-02" },	// 2系までの iOS/Android(2016〜2019)
	c92:      { titlebg: "title-bg-02", background: "background-02" },
	c90:      { titlebg: "title-bg-01", background: "background-01" }
};
function set_waitload(state)
{
	set_group("waitload", state);
}
function set_group(name, state)
{
	var elements = document.getElementsByClassName(name);
	for(var i=0; i<elements.length; i++)
	{
		elements[i].style.display = state;
	}
}
function toggle_tab(name)
{
	var tab = TABS[name] || TABS.kimagure;
	if(!TABS[name]) name = "kimagure";
	// 先に全部隠してから、選んだタブの要素だけ出す(両方に属する要素は最後の block が勝つ)
	for(var key in TABS)
	{
		set_group(key, "none");
		var button = document.getElementsByClassName(key + "-tab")[0];
		if(button) button.classList.remove('tab-select');
	}
	set_group(name, "block");
	var selected = document.getElementsByClassName(name + "-tab")[0];
	if(selected) selected.classList.add('tab-select');
	titlebg.className = tab.titlebg;
	background.className = tab.background;
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
	// ?tab= が無ければ最新の 3系(kimagure)を出す
	toggle_tab(params["tab"]);
    set_waitload("none");
};
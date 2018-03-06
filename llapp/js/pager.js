var mobiles = document.getElementsByClassName("mobile");
function set_mobile(state)
{
	for(var i=0; i<mobiles.length; i++)
	{
		var element = mobiles[i] ;
		element.style.display = state;
	}
}
function toggle_mobile()
{
	set_mobile("block");
}
window.onload = function()
{
	toggle_mobile();
};

function download() {
console.log("hello world!");

};
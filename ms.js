(function(){var D=[["She","don\u2019t","doesn\u2019t","like tea.","\u0645\u0639 she \u0628\u0646\u0633\u062a\u062e\u062f\u0645 doesn\u2019t."],["I","am agree","agree","with you.","\u0645\u0641\u064a\u0634 am \u0642\u0628\u0644 agree\u060c \u0644\u0623\u0646\u0647 \u0641\u0639\u0644."],["He","go","goes","to school every day.","\u0645\u0639 he \u0628\u0646\u0632\u0648\u0651\u062f s \u0639\u0644\u0649 \u0627\u0644\u0641\u0639\u0644."]];
var sen=document.getElementById('ms_sen'),why=document.getElementById('ms_why'),go=document.getElementById('ms_go');if(!sen||!go)return;
var k=0,done=true,tm;
function show(){var d=D[k];sen.innerHTML=d[0]+' <s id="ms_b">'+d[1]+'</s> <em id="ms_f"></em> '+d[3];why.textContent=''}
function fix(){var d=D[k],b=document.getElementById('ms_b'),f=document.getElementById('ms_f'),n=0;b.className='x';clearInterval(tm);tm=setInterval(function(){f.textContent=d[2].slice(0,++n);if(n>=d[2].length){clearInterval(tm);why.textContent=d[4]}},90)}
go.onclick=function(){if(done){done=false;fix();go.textContent='\u062c\u0645\u0644\u0629 \u062a\u0627\u0646\u064a\u0629'}else{k=(k+1)%D.length;done=true;show();go.textContent='\u0635\u062d\u0651\u062d \u0627\u0644\u062c\u0645\u0644\u0629'}};
show()})();

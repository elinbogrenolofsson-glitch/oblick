/* Lägg till eller byt ut titlar i SERIES. Statusval sparas separat i localStorage. */
const SERIES = window.OBLICK_SERIES;
const KEY="oblick-series-status-v1", REVIEW_KEY="oblick-discover-reviewed-v1", META_KEY="oblick-series-meta-v1", FAVORITE_KEY="oblick-series-favorites-v1", PERSONAL_KEY="oblick-series-personal-v1", DIARY_KEY="oblick-series-diary-v1", WATCH_LATER_KEY="oblick-series-watch-later-v1";
let statuses={};try{statuses=JSON.parse(localStorage.getItem(KEY)||"{}")}catch(e){}
let reviewed={};try{reviewed=JSON.parse(localStorage.getItem(REVIEW_KEY)||"{}")}catch(e){}
let metadata={};try{metadata=JSON.parse(localStorage.getItem(META_KEY)||"{}")}catch(e){}
let favorites={};try{favorites=JSON.parse(localStorage.getItem(FAVORITE_KEY)||"{}")}catch(e){}
let watchLater={};try{watchLater=JSON.parse(localStorage.getItem(WATCH_LATER_KEY)||"{}")}catch(e){}
let personal={};try{personal=JSON.parse(localStorage.getItem(PERSONAL_KEY)||"{}")}catch(e){}
let diary=[];try{diary=JSON.parse(localStorage.getItem(DIARY_KEY)||"[]")}catch(e){}
let discoverChoice=null;
const pendingMeta={};
let view="all",mode="grid";
const $=id=>document.getElementById(id);
const statusName=s=>s==="done"?"Sett klart":s==="started"?"Påbörjat":"";
function save(){try{localStorage.setItem(KEY,JSON.stringify(statuses))}catch(e){alert("Kunde inte spara i webbläsaren.")}}
function saveReviewed(){try{localStorage.setItem(REVIEW_KEY,JSON.stringify(reviewed))}catch(e){}}
function savePersonal(){try{localStorage.setItem(PERSONAL_KEY,JSON.stringify(personal));localStorage.setItem(DIARY_KEY,JSON.stringify(diary))}catch(e){alert("Kunde inte spara personliga uppgifter.")}}
function saveWatchLater(){try{localStorage.setItem(WATCH_LATER_KEY,JSON.stringify(watchLater))}catch(e){alert("Kunde inte spara Titta senare-listan.")}}
function toggleWatchLater(title){if(!title)return;const adding=!watchLater[title];if(adding)watchLater[title]=true;else delete watchLater[title];saveWatchLater();diaryEvent(title,adding?"Sparad i Titta senare":"Borttagen från Titta senare");render();if(!$("profileModal").classList.contains("hidden"))openProfile(title)}
function personalFor(title){return personal[title]||(personal[title]={rating:0,notes:"",next:false,seasonWatch:false,seasonNote:""})}
function diaryEvent(title,event){diary.unshift({title,event,date:new Date().toISOString().slice(0,10)});diary=diary.slice(0,500);savePersonal()}
function stripHtml(s){const d=document.createElement("div");d.innerHTML=s||"";return (d.textContent||d.innerText||"").replace(/\s+/g," ").trim()}
async function ensureMeta(s){
 const existing=metadata[s.title];
 const usableImage=typeof existing?.image==="string"&&/^https:\/\//i.test(existing.image);
 if(usableImage)return existing;
 const retryAfter=existing?.fetchError?2*60*60*1000:12*60*60*1000;
 if(existing?.fetchedAt&&Date.now()-existing.fetchedAt<retryAfter)return existing;
 if(pendingMeta[s.title])return pendingMeta[s.title];
 pendingMeta[s.title]=(async()=>{
  try{
   const controller=new AbortController();
   const timeout=setTimeout(()=>controller.abort(),12000);
   let r;
   try{r=await fetch("https://api.tvmaze.com/search/shows?q="+encodeURIComponent(s.title),{signal:controller.signal})}
   finally{clearTimeout(timeout)}
   if(!r.ok)throw new Error("TVMaze svarade med "+r.status);
   const results=await r.json();
   const exact=results.find(x=>x.show&&x.show.name.toLowerCase()===s.title.toLowerCase());
   const candidate=exact||results.find(x=>x.show&&(!s.year||!x.show.premiered||String(x.show.premiered).slice(0,4)===String(s.year)))||results[0];
   if(!candidate?.show)throw new Error("Serien hittades inte: "+s.title);
   const sh=candidate.show;
   const previous=metadata[s.title]||{};
   const rawImage=sh.image&&(sh.image.original||sh.image.medium);
   const safeImage=typeof rawImage==="string"&&/^https:\/\//i.test(rawImage)?rawImage:"";
   metadata[s.title]={...previous,image:safeImage||previous.image||"",genres:Array.isArray(sh.genres)?sh.genres:previous.genres||[],summary:stripHtml(sh.summary)||previous.summary||"",premiered:sh.premiered||previous.premiered||"",status:sh.status||previous.status||"",seasons:previous.seasons??null,fetchedAt:Date.now(),fetchError:false};
   try{localStorage.setItem(META_KEY,JSON.stringify(metadata))}catch(e){}
   if(view==="discover")renderSwipe();else render();
   if(metadata[s.title].seasons===null){
    try{
     const sr=await fetch("https://api.tvmaze.com/shows/"+sh.id+"/seasons");
     if(sr.ok){const ss=await sr.json();metadata[s.title].seasons=Array.isArray(ss)?ss.length:null;try{localStorage.setItem(META_KEY,JSON.stringify(metadata))}catch(e){}}
    }catch(e){}
   }
   return metadata[s.title];
  }catch(e){
   console.warn("OBLICK kunde inte hämta omslag för "+s.title,e);
   metadata[s.title]={...(metadata[s.title]||{}),fetchedAt:Date.now(),fetchError:true};
   try{localStorage.setItem(META_KEY,JSON.stringify(metadata))}catch(storageError){}
   return metadata[s.title]||null;
  }finally{delete pendingMeta[s.title]}
 })();
 return pendingMeta[s.title];
}
function safe(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function filtered(){
 let q=$("search").value.trim().toLocaleLowerCase("sv"),sf=$("statusFilter").value,sort=$("sort").value;
 let a=SERIES.filter(s=>(s.title+" "+(s.year||"")).toLocaleLowerCase("sv").includes(q));
 if(view==="later")a=a.filter(s=>!!watchLater[s.title]);
 if(view==="started")a=a.filter(s=>statuses[s.title]==="started");
 if(view==="done")a=a.filter(s=>statuses[s.title]==="done");
 if(view==="mine")a=a.filter(s=>!!statuses[s.title]);
 if(view==="favorites")a=a.filter(s=>!!favorites[s.title]);
 if(view==="watch")a=a.filter(s=>!!personalFor(s.title).seasonWatch);
 if(sf==="none")a=a.filter(s=>!statuses[s.title]);else if(sf!=="all")a=a.filter(s=>statuses[s.title]===sf);
 return a.sort((a,b)=>sort==="za"?b.title.localeCompare(a.title,"sv"):sort==="year"?(b.year||0)-(a.year||0):a.title.localeCompare(b.title,"sv"));
}
function actions(s,compact=false){return '<div class="'+(compact?"list-actions":"card-actions")+'"><button class="status-btn '+(statuses[s.title]==="started"?"chosen":"") +'" aria-pressed="'+(statuses[s.title]==="started") +'" data-title="'+safe(s.title)+'" data-status="started">Påbörjat</button><button class="status-btn '+(statuses[s.title]==="done"?"chosen":"") +'" aria-pressed="'+(statuses[s.title]==="done") +'" data-title="'+safe(s.title)+'" data-status="done">Sett klart</button><button class="favorite-btn '+(favorites[s.title]?"active":"") +'" title="Favorit" data-favorite="'+safe(s.title)+'">'+(favorites[s.title]?"♥":"♡")+'</button><button class="favorite-btn watch-later-btn '+(watchLater[s.title]?"active":"") +'" title="'+(watchLater[s.title]?"Ta bort från Titta senare":"Spara till Titta senare")+'" data-watch-later="'+safe(s.title)+'">'+(watchLater[s.title]?"＋ ✓":"＋ Senare")+'</button></div>'}
function posterStyle(s,i){const m=metadata[s.title];return m&&m.image?`background-image:url(&quot;${safe(m.image)}&quot;)`:`background-image:linear-gradient(145deg,hsl(${i*37%360} 35% 48%),#51483d 70%)`}
function extraMeta(s){const m=metadata[s.title];if(!m)return "";const genres=Array.isArray(m.genres)?m.genres:[];return `${genres.length?`<div class="series-extra">${genres.slice(0,3).map(safe).join(" · ")}${m.seasons?` · ${m.seasons} säsonger`:""}</div>`:""}${m.summary?`<p class="series-summary">${safe(m.summary.slice(0,135))}${m.summary.length>135?"…":""}</p>`:""} `}
function card(s,i,home=false){
 let initials=s.title.split(" ").slice(0,2).join(" ");
 const quick=home?'<button class="favorite-btn '+(favorites[s.title]?"active":"") +'" title="Favorit" data-favorite="'+safe(s.title)+'">'+(favorites[s.title]?"♥":"♡")+'</button><button class="favorite-btn watch-later-btn '+(watchLater[s.title]?"active":"") +'" title="'+(watchLater[s.title]?"Ta bort från Titta senare":"Spara till Titta senare")+'" data-watch-later="'+safe(s.title)+'">'+(watchLater[s.title]?"＋ ✓":"＋ Senare")+'</button>':"";
 return '<article class="series-card"><div class="poster" data-profile="'+safe(s.title)+'" role="button" tabindex="0" aria-label="Öppna serieprofil för '+safe(s.title)+'" style="'+posterStyle(s,i)+'"><span class="poster-num">'+String(i+1).padStart(2,"0") + '</span></div><div class="card-meta"><div class="card-topline"><button class="profile-title-button" data-profile="'+safe(s.title)+'">'+safe(s.title)+'</button>'+quick+'</div><div class="card-year">'+(s.year||"Årtal saknas")+(statuses[s.title]?' · '+statusName(statuses[s.title]):'')+'</div>'+extraMeta(s)+(home?"":actions(s))+'</div></article>';
}
function row(s,i){return '<article class="list-row"><div class="mini-poster" data-profile="'+safe(s.title)+'" role="button" tabindex="0" aria-label="Öppna serieprofil för '+safe(s.title)+'" style="'+(metadata[s.title]&&metadata[s.title].image?'background-image:linear-gradient(180deg,rgba(0,0,0,.08),rgba(0,0,0,.65)),url(&quot;'+safe(metadata[s.title].image)+'&quot;);background-size:cover;background-position:center;color:white;text-shadow:0 1px 4px #000':'')+'">'+(metadata[s.title]&&metadata[s.title].image?'':safe(s.title.split(" ").slice(0,2).join(" ")))+'</div><div><button class="profile-title-button list-name" data-profile="'+safe(s.title)+'">'+safe(s.title)+'</button><div class="list-year">'+(s.year||"Årtal saknas")+(statuses[s.title]?' · '+statusName(statuses[s.title]):' · Ej markerad')+'</div></div><div class="list-year">'+(s.year||"—")+'</div>'+actions(s,true)+'</article>'}
function currentDiscover(){const genre=$("discoverGenre")?$("discoverGenre").value:"";let candidates=SERIES.filter(s=>!statuses[s.title]&&!reviewed[s.title]&&(!genre||(metadata[s.title]&&metadata[s.title].genres&&metadata[s.title].genres.includes(genre))));if(!candidates.length&&genre){return null}if(discoverChoice&&candidates.some(s=>s.title===discoverChoice))return candidates.find(s=>s.title===discoverChoice);return candidates[0]||null}
function renderSwipe(){const s=currentDiscover();$("discoverProgress").textContent=Object.keys(reviewed).filter(k=>reviewed[k]).length+" av "+SERIES.length+" granskade";if(!s){const genre=$("discoverGenre").value;const noMatches=genre&&SERIES.some(x=>!statuses[x.title]&&!reviewed[x.title]);$("discoverCard").innerHTML=noMatches?'<div class="discover-finished"><div class="eyebrow">Genrefilter</div><h3>Hämtar genrer eller inga fler träffar</h3><p>Om inget visas efter en liten stund, välj en annan genre eller Alla genrer.</p></div>':'<div class="discover-finished"><div class="eyebrow">Du är ikapp</div><h3>Du har gått igenom alla serier!</h3><p>Börja om för att få en ny runda.</p></div>';["notSeenBtn","discoverStartedBtn","discoverDoneBtn"].forEach(id=>$(id).disabled=true);return}["notSeenBtn","discoverStartedBtn","discoverDoneBtn"].forEach(id=>$(id).disabled=false);const i=SERIES.indexOf(s),m=metadata[s.title];$("discoverCard").innerHTML=`<div class="discover-art" style="${posterStyle(s,i)}"><span class="discover-index">${String(i+1).padStart(3,"0")} / ${SERIES.length}</span></div><div class="discover-info"><div class="eyebrow">Nästa i arkivet</div><h3>${safe(s.title)}</h3><div class="discover-tags">${safe((m&&m.genres&&m.genres.length?m.genres.join(" · "):"Serie"))} · ${s.year||"Årtal saknas"}${m&&m.seasons?" · "+m.seasons+" säsonger":""}</div><p>${safe(m&&m.summary?m.summary:"Hämtar serieinformation…")}</p><button class="small-btn watch-later-btn ${watchLater[s.title]?"active":""}" data-watch-later="${safe(s.title)}">${watchLater[s.title]?"✓ Sparad i Titta senare":"＋ Spara till Titta senare"}</button>${statuses[s.title]?`<div class="current-status">Nuvarande status: ${statusName(statuses[s.title])}</div>`:""}</div>`;if(!m)ensureMeta(s)}
function chooseDiscover(action){const s=currentDiscover();if(!s)return;if(action==="started"||action==="done")statuses[s.title]=action;else delete statuses[s.title];reviewed[s.title]=true;discoverChoice=null;save();saveReviewed();render()}
function renderHomeHighlights(){const section=$("homeHighlights");if(!section)return;const active=view==="all";section.classList.toggle("hidden",!active);if(!active)return;const started=SERIES.filter(s=>statuses[s.title]==="started").slice(0,5);const favs=SERIES.filter(s=>favorites[s.title]).slice(0,5);const later=SERIES.filter(s=>watchLater[s.title]).slice(0,5);$("homeStarted").innerHTML=started.map(s=>card(s,SERIES.indexOf(s),true)).join("");$("homeFavorites").innerHTML=favs.map(s=>card(s,SERIES.indexOf(s),true)).join("");$("homeLater").innerHTML=later.map(s=>card(s,SERIES.indexOf(s),true)).join("");}
function render(){
 const done=SERIES.filter(s=>statuses[s.title]==="done").length,started=SERIES.filter(s=>statuses[s.title]==="started").length,mine=done+started;
 if(view==="discover"){$("discoverPanel").classList.remove("hidden");document.querySelector(".toolbar").classList.add("hidden");document.querySelector(".section-head").classList.add("hidden");$("results").classList.add("hidden");$("empty").classList.add("hidden");renderSwipe();}else{$("discoverPanel").classList.add("hidden");document.querySelector(".toolbar").classList.remove("hidden");document.querySelector(".section-head").classList.remove("hidden");}
 $("allCount").textContent=SERIES.length;$("startedCount").textContent=started;$("doneCount").textContent=done;$("mineCount").textContent=mine;$("favoriteCount").textContent=Object.values(favorites).filter(Boolean).length;$("watchLaterCount").textContent=Object.values(watchLater).filter(Boolean).length;$("watchCount").textContent=SERIES.filter(s=>personalFor(s.title).seasonWatch).length;
 document.querySelectorAll(".navbtn").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
 const titles={all:["Alla serier","En katalog över dina berättelser."],started:["Påbörjat","Serier du har börjat följa."],done:["Sett klart","Avslutade säsonger och berättelser."],mine:["Min lista","Din personliga överblick över markerade serier."],favorites:["Favoriter","Serier du vill spara extra nära."],later:["Titta senare","Serier du har sparat för att se vid ett senare tillfälle."],watch:["Säsongsbevakning","Serier du väntar på nya säsonger av."],stats:["Statistik","Se hur ditt tittararkiv växer."],discover:["Upptäck","Hitta nästa serie utan att behöva leta."]};
 $("viewTitle").textContent=titles[view][0];$("viewSub").textContent=titles[view][1];
 renderHomeHighlights();
  const arr=filtered();if(view!=="discover"&&view!=="stats")arr.slice(0,12).forEach(s=>{if(!metadata[s.title]?.image)ensureMeta(s)});if(view==="all"&&!window.__oblickPosterLoadStarted){window.__oblickPosterLoadStarted=true;let posterIndex=0;const posterWorkers=Array.from({length:3},async()=>{while(posterIndex<SERIES.length){const item=SERIES[posterIndex++];if(!metadata[item.title]?.image)await ensureMeta(item)}});Promise.all(posterWorkers).then(()=>render())}$("resultCount").textContent=arr.length+" "+(arr.length===1?"titel":"titlar");
 $("results").className=mode==="grid"?"grid":"list";$("results").innerHTML=arr.map((s,i)=>mode==="grid"?card(s,i):row(s,i)).join("");
 $("empty").classList.toggle("hidden",view==="discover"||view==="stats"||arr.length>0);$("results").classList.toggle("hidden",view==="discover"||view==="stats"||arr.length===0);$("statsPanel").classList.toggle("hidden",view!=="stats");if(view==="stats")renderStats();
 $("gridBtn").classList.toggle("active",mode==="grid");$("listBtn").classList.toggle("active",mode==="list");
}

function renderStats(){
 const done=SERIES.filter(s=>statuses[s.title]==="done").length;
 const started=SERIES.filter(s=>statuses[s.title]==="started").length;
 const unseen=SERIES.length-done-started;
 const fav=Object.values(favorites).filter(Boolean).length;
 const later=Object.values(watchLater).filter(Boolean).length;
 const watching=SERIES.filter(s=>personalFor(s.title).seasonWatch).length;
 const rated=SERIES.map(s=>({title:s.title,rating:Number(personalFor(s.title).rating)||0})).filter(s=>s.rating>0).sort((a,b)=>b.rating-a.rating);
 const avg=rated.length?(rated.reduce((sum,s)=>sum+s.rating,0)/rated.length).toFixed(1):"—";
 const genreCounts={};
 SERIES.forEach(s=>(metadata[s.title]?.genres||[]).forEach(g=>genreCounts[g]=(genreCounts[g]||0)+1));
 const genres=Object.entries(genreCounts).sort((a,b)=>b[1]-a[1]).slice(0,7);
 const pct=n=>SERIES.length?Math.round(n/SERIES.length*100):0;
 $("statsContent").innerHTML=`<div class="stats-dashboard">
 <div class="stat-tile"><strong>${SERIES.length}</strong><span>Serier i katalogen</span></div>
 <div class="stat-tile"><strong>${done}</strong><span>Sett klart</span></div>
 <div class="stat-tile"><strong>${started}</strong><span>Påbörjade</span></div>
 <div class="stat-tile"><strong>${unseen}</strong><span>Ej markerade</span></div>
 <div class="stat-tile"><strong>${later}</strong><span>Titta senare</span></div>
 <div class="stat-tile"><strong>${avg}</strong><span>Snittbetyg · ${rated.length} betyg</span></div>
 </div>
 <h3 class="stats-heading">Ditt arkiv</h3>
 <div class="stats-detail-grid">
 <div class="stats-detail"><span>Av katalogen markerad som klar</span><strong>${pct(done)}%</strong></div>
 <div class="stats-detail"><span>Favoriter</span><strong>${fav}</strong></div>
 <div class="stats-detail"><span>Säsongsbevakning</span><strong>${watching}</strong></div>
 </div>
 <div class="archive-progress"><div class="archive-progress-head"><span>Din samling, markerad</span><strong>${pct(done+started)}%</strong></div><div class="archive-progress-track"><div class="archive-progress-fill" style="width:${pct(done+started)}%"></div></div><p>${done+started} av ${SERIES.length} serier har fått en status. Resten väntar på att upptäckas.</p></div>
 <h3 class="stats-heading">Statusfördelning</h3>
 ${[["Sett klart",done],["Påbörjat",started],["Ej markerade",unseen]].map(([label,n])=>`<div class="bar-row"><span>${label}</span><div class="bar-track"><div class="bar-fill" style="width:${pct(n)}%"></div></div><span>${n} · ${pct(n)}%</span></div>`).join("")}
 <h3 class="stats-heading">Dina högst betygsatta serier</h3>
 ${rated.length?`<div class="rated-list">${rated.slice(0,5).map(s=>`<div class="rated-row"><button class="profile-title-button" data-profile="${safe(s.title)}">${safe(s.title)}</button><strong>${s.rating}/10</strong></div>`).join("")}</div>`:'<p class="side-copy">Sätt betyg på en serie i dess profil så dyker dina favoriter upp här.</p>'}
 <h3 class="stats-heading">Vanliga genrer i katalogen</h3>
 <p class="side-copy">Genrestatistiken bygger på serieinformation som har hämtats.</p>
 ${genres.map(([g,n])=>`<div class="bar-row"><span>${safe(g)}</span><div class="bar-track"><div class="bar-fill" style="width:${n/(genres[0]?.[1]||1)*100}%"></div></div><span>${n}</span></div>`).join("")||'<p class="side-copy">Genrer visas när serieinformationen har hämtats.</p>'}`;
}
function openProfile(title){const s=SERIES.find(x=>x.title===title);if(!s)return;const m=metadata[title]||{};const mine=personalFor(title);$("profileContent").innerHTML=`<div class="profile-layout"><div class="profile-poster" style="${posterStyle(s,SERIES.indexOf(s))}"></div><div class="profile-text"><div class="eyebrow">Serieprofil · ${s.year||"Årtal saknas"}</div><h2 id="profileTitle">${safe(s.title)}</h2><div class="discover-tags">${safe((m.genres||[]).join(" · ")||"Hämtar genrer…")}${m.seasons?" · "+m.seasons+" säsonger":""}${m.status?" · "+safe(m.status):""}</div><p>${safe(m.summary||"Ingen sammanfattning tillgänglig ännu.")}</p><div class="profile-status-line"><span>Din status</span><strong>${statusName(statuses[title])||"Inte markerad"}</strong></div><div class="personal-fields"><label>Betyg (1–10)<input id="profileRating" class="control" type="number" min="0" max="10" value="${Number(mine.rating)||0}" style="width:100%;margin:6px 0 12px"></label><label>Personliga anteckningar<textarea id="profileNotes" class="control" rows="3" style="width:100%;margin:6px 0 12px;resize:vertical" placeholder="Vad tyckte du?">${safe(mine.notes||"")}</textarea></label><label style="display:block;margin:8px 0"><input id="profileWatch" type="checkbox" ${mine.seasonWatch?"checked":""}> Bevaka nästa säsong</label><label>Bevakningsnotering<input id="profileSeasonNote" class="control" style="width:100%;margin:6px 0 12px" value="${safe(mine.seasonNote||"")}" placeholder="T.ex. väntar på säsong 3"></label><button class="small-btn" id="savePersonalBtn">Spara personliga uppgifter</button></div><div class="card-actions"><button class="status-btn ${statuses[title]==="started"?"chosen":""}" aria-pressed="${statuses[title]==="started"}" data-title="${safe(title)}" data-status="started">Påbörjat</button><button class="status-btn ${statuses[title]==="done"?"chosen":""}" aria-pressed="${statuses[title]==="done"}" data-title="${safe(title)}" data-status="done">Sett klart</button><button class="favorite-btn ${favorites[title]?"active":""}" data-favorite="${safe(title)}">${favorites[title]?"♥ Favorit":"♡ Favorit"}</button><button class="small-btn watch-later-btn ${watchLater[title]?"active":""}" data-watch-later="${safe(title)}">${watchLater[title]?"✓ Sparad till senare":"＋ Titta senare"}</button></div></div></div>`;$("profileModal").classList.remove("hidden");if(!m.image)ensureMeta(s)}
function setSeriesStatus(title,status){
 if(!title||!status)return;
 if(statuses[title]===status)delete statuses[title];else statuses[title]=status;
 try{localStorage.setItem(KEY,JSON.stringify(statuses));}catch(err){alert("OBLICK kunde inte spara statusen i webbläsaren.");}
 diaryEvent(title,statuses[title]?statusName(statuses[title]):"Status avmarkerad");
 render();
 if(!$("profileModal").classList.contains("hidden"))openProfile(title);
}
document.addEventListener("click",e=>{if(e.target.closest("#clearFiltersBtn")){$("search").value="";$("statusFilter").value="all";$("sort").value="az";render();return}const watch=e.target.closest("[data-watch-later]");if(watch){toggleWatchLater(watch.dataset.watchLater);return}const status=e.target.closest("button[data-status]");if(status){setSeriesStatus(status.dataset.title,status.dataset.status);return}const fav=e.target.closest("[data-favorite]");if(fav){const title=fav.dataset.favorite;favorites[title]=!favorites[title];if(!favorites[title])delete favorites[title];try{localStorage.setItem(FAVORITE_KEY,JSON.stringify(favorites))}catch(e){}render();if(!$("profileModal").classList.contains("hidden"))openProfile(title);return}const prof=e.target.closest("[data-profile]");if(prof){openProfile(prof.dataset.profile);return}});
document.addEventListener("keydown",e=>{const poster=e.target.closest("[data-profile][role=button]");if(poster&&(e.key==="Enter"||e.key===" ")){e.preventDefault();openProfile(poster.dataset.profile)}});document.querySelectorAll(".navbtn,[data-view]").forEach(b=>b.addEventListener("click",()=>{view=b.dataset.view;render()}));
$("profileContent").addEventListener("click",e=>{if(e.target.id==="savePersonalBtn"){const title=$("profileTitle")?.textContent;if(!title)return;const p=personalFor(title);p.rating=Math.max(0,Math.min(10,Number($("profileRating").value)||0));p.notes=$("profileNotes").value;p.seasonWatch=$("profileWatch").checked;p.seasonNote=$("profileSeasonNote").value;savePersonal();render();openProfile(title);}});
$("closeProfile").onclick=()=>$("profileModal").classList.add("hidden");$("profileModal").addEventListener("click",e=>{if(e.target===$("profileModal"))$("profileModal").classList.add("hidden")});document.addEventListener("keydown",e=>{if(e.key==="Escape")$("profileModal").classList.add("hidden")});async function loadGenreMetadata(){const missing=SERIES.filter(s=>!metadata[s.title]);let index=0;const workers=Array.from({length:4},async()=>{while(index<missing.length){const s=missing[index++];await ensureMeta(s)}});await Promise.all(workers)}$("randomDiscover").onclick=()=>{const genre=$("discoverGenre").value;const candidates=SERIES.filter(s=>!statuses[s.title]&&!reviewed[s.title]&&(!genre||(metadata[s.title]?.genres||[]).includes(genre)));discoverChoice=candidates.length?candidates[Math.floor(Math.random()*candidates.length)].title:null;renderSwipe()};$("discoverGenre").onchange=async()=>{discoverChoice=null;if($("discoverGenre").value)await loadGenreMetadata();renderSwipe()};
$("notSeenBtn").onclick=()=>chooseDiscover("none");$("discoverStartedBtn").onclick=()=>chooseDiscover("started");$("discoverDoneBtn").onclick=()=>chooseDiscover("done");$("restartDiscover").onclick=()=>{reviewed={};saveReviewed();render()};
["search","statusFilter","sort"].forEach(id=>$(id).addEventListener(id==="search"?"input":"change",render));
$("gridBtn").onclick=()=>{mode="grid";render()};$("listBtn").onclick=()=>{mode="list";render()};$("randomArchiveBtn").onclick=()=>{const s=SERIES[Math.floor(Math.random()*SERIES.length)];if(s)openProfile(s.title)};
render();
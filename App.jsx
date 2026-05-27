import { useState } from "react";

const GOLD="#c8922a", DARK="#0f0f0f", DARK2="#1a1a1a", DARK3="#252525", BORDER="#2e2e2e", MUTED="#888";
const CATS=["Video","Photo","Drone","Audio","Other"];
const CAT_COLORS={Video:[30,30,30],Photo:[74,127,165],Drone:[106,95,165],Audio:[74,154,106],Other:[136,136,136]};
let _id=9;

const inp={width:"100%",background:DARK2,border:`1px solid ${BORDER}`,borderRadius:6,color:"#eee",fontFamily:"inherit",fontSize:"0.95rem",padding:"0.65rem 0.85rem",outline:"none",WebkitAppearance:"none",boxSizing:"border-box"};
const sel={...inp,backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%23888' d='M5 6L0 0h10z'/%3E%3C/svg%3E")`,backgroundRepeat:"no-repeat",backgroundPosition:"right 0.8rem center",paddingRight:"2rem"};
const lblSt={display:"block",fontSize:"0.62rem",color:MUTED,marginBottom:"0.25rem",fontFamily:"monospace",letterSpacing:"0.06em",textTransform:"uppercase"};
const secLbl={fontFamily:"monospace",fontSize:"0.58rem",letterSpacing:"0.18em",textTransform:"uppercase",color:GOLD,margin:"1.25rem 0 0.6rem",paddingBottom:"0.35rem",borderBottom:`1px solid ${BORDER}`};

function Field({label,children}){return <div style={{marginBottom:"0.7rem"}}><label style={lblSt}>{label}</label>{children}</div>;}
function fmtP(val){const n=parseFloat(val);if(isNaN(n))return"";return"$"+n.toLocaleString("en-AU",{minimumFractionDigits:2,maximumFractionDigits:2});}
function fmtP0(val){const n=parseFloat(val);if(isNaN(n))return"";return"$"+n.toLocaleString("en-AU",{minimumFractionDigits:0,maximumFractionDigits:0});}

// ── LOGO NORMALISATION ──
// Converts any uploaded image (WebP, HEIC, PNG, JPEG, etc.) to a clean PNG
// data URL via an off-screen canvas. This guarantees jsPDF always gets a
// format it can handle, and avoids silent crashes when a phone uploads HEIC/WebP.
function normaliseImageToPng(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = (ev) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not decode image"));
      img.onload = () => {
        // Cap at 800px wide to keep the data URL small
        const MAX = 800;
        let w = img.naturalWidth, h = img.naturalHeight;
        if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

async function loadJsPDF(){
  if(window.jspdf)return;
  await new Promise((res,rej)=>{
    const s=document.createElement("script");
    s.src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    s.onload=res; s.onerror=()=>rej(new Error("Failed to load PDF library. Check internet connection."));
    document.head.appendChild(s);
  });
}

function pdfHeader(doc,logoUrl,title,subtitle,refNum,date,extra,W,mg){
  doc.setFillColor(30,30,30); doc.rect(0,0,W,50,"F");
  doc.setFillColor(200,146,42); doc.rect(0,50,W*0.65,2.5,"F");
  if(logoUrl){
    // logoUrl is always a PNG data URL thanks to normaliseImageToPng
    try{ doc.addImage(logoUrl,"PNG",mg,7,55,18,"","FAST"); }catch(e){ console.warn("Logo insert failed:",e); }
  } else {
    doc.setFont("helvetica","bold");doc.setFontSize(13);doc.setTextColor(255,255,255);doc.text("Unwritten Films",mg,18);
  }
  doc.setFont("helvetica","bold");doc.setFontSize(19);doc.setTextColor(255,255,255);
  doc.text(title.toUpperCase(),mg,36);
  doc.setFontSize(10);doc.setTextColor(200,146,42);doc.text(subtitle,mg,44);
  doc.setFont("helvetica","normal");doc.setFontSize(8);
  doc.setTextColor(200,146,42);doc.text(refNum,W-mg,20,{align:"right"});
  doc.setTextColor(180,180,180);doc.text(date,W-mg,27,{align:"right"});
  if(extra)doc.text(extra,W-mg,34,{align:"right"});
}

function pdfBriefGrid(doc,cells,y,mg,cW){
  const cellW=cW/cells.length;
  doc.setDrawColor(210,200,185);doc.setLineWidth(0.3);
  cells.forEach((c,i)=>{
    const cx=mg+i*cellW;
    doc.setFillColor(255,255,255);doc.rect(cx,y,cellW,14,"FD");
    doc.setFont("helvetica","normal");doc.setFontSize(5.5);doc.setTextColor(150,150,150);doc.text(c.label,cx+3,y+5);
    doc.setFont("helvetica","bold");doc.setFontSize(7.5);doc.setTextColor(30,30,30);
    doc.text(doc.splitTextToSize(c.val,cellW-6)[0],cx+3,y+11);
  });
  return y+18;
}

function pdfFooter(doc,contact,H,mg,W){
  doc.setFillColor(30,30,30);doc.rect(0,H-22,W,22,"F");
  doc.setFont("helvetica","bold");doc.setFontSize(9);doc.setTextColor(255,255,255);
  doc.text(contact.name||"Unwritten Films",mg,H-14);
  doc.setFont("helvetica","normal");doc.setFontSize(6.5);doc.setTextColor(200,146,42);
  doc.text("Videographer & Photographer · Mackay, QLD",mg,H-9);
  const cl=[contact.phone,contact.email].filter(Boolean).join("  ·  ");
  doc.setTextColor(150,150,150);if(cl)doc.text(cl,mg,H-4);
}

export default function App(){
  const [tab,setTab]=useState(0);
  const [screen,setScreen]=useState("form");
  const [logoUrl,setLogoUrl]=useState(null);
  const [logoError,setLogoError]=useState("");
  const [pdfStatus,setPdfStatus]=useState("idle");
  const [pdfError,setPdfError]=useState("");
  const [pdfDataUrl,setPdfDataUrl]=useState(null);
  const [pdfFilename,setPdfFilename]=useState("");

  // Invoice state
  const [invStatus,setInvStatus]=useState("idle");
  const [invError,setInvError]=useState("");
  const [invDataUrl,setInvDataUrl]=useState(null);
  const [invFilename,setInvFilename]=useState("");
  const [invNum,setInvNum]=useState("INV-2026-001");
  const [invDate,setInvDate]=useState(new Date().toLocaleDateString("en-AU",{day:"2-digit",month:"2-digit",year:"numeric"}));
  const [invDue,setInvDue]=useState("");
  const [invABN,setInvABN]=useState("");
  const [invNote,setInvNote]=useState("");
  const [invBankName,setInvBankName]=useState("");
  const [invBSB,setInvBSB]=useState("");
  const [invAcct,setInvAcct]=useState("");
  const [invAcctName,setInvAcctName]=useState("Riley Battese");
  // Payment status
  const [paidStatus,setPaidStatus]=useState("none");
  const [amtPaid,setAmtPaid]=useState("");

  const [form,setForm]=useState({
    quoteNum:"QT-2026-001",validDays:"30",
    client:"",project:"",location:"Mackay, QLD",shoot:"",
    notes:"All equipment included\n1 round of client revisions included\nDrone subject to CASA regulations and site clearance\nDelivery via private online gallery / WeTransfer\nTurnaround: 7–10 business days",
    contactName:"Riley Battese",phone:"0428 926 571",email:"riley@unwrittenfilmsau.com",web:"",
    discLabel:"Returning Client Discount",discount:"",gst:true,
    payment:"50% deposit required to secure the booking date. Balance due within 7 days of final delivery.",
    cancel:"Cancellations within 48 hours of shoot day will forfeit the deposit. Rescheduling subject to availability at no charge with 72+ hours notice.",
    usage:"Client receives full commercial usage rights for all delivered content. Raw files remain the property of the operator unless purchased separately.",
  });

  const [items,setItems]=useState([
    {id:1,name:"Workshop Reveal Film",category:"Video",price:"1000",included:false,strikePrice:false,description:"Cinematic reveal video (2–3 min). Full walk-through of the facility — glass façade, roller door bays, workshop floor, office level, loading bay. Includes story-driven edit, colour grade, and licensed background music."},
    {id:2,name:"Short-Form Social Cut",category:"Video",price:"250",included:false,strikePrice:false,description:"60-second social media edit cut from the main film. Optimised for vertical/square and landscape formats (Instagram Reels, Facebook, LinkedIn). Fast-paced, punchy transitions."},
    {id:3,name:"Aerial Reveal Sequence",category:"Drone",price:"450",included:false,strikePrice:true,description:"DJI aerial footage of the full building exterior, site context, and surrounding area. Dramatic approach shots across the glass front façade. Footage integrated into main film + supplied as raw files. Subject to CASA regulations and site clearance."},
    {id:4,name:"Commercial Photo Package",category:"Photo",price:"700",included:false,strikePrice:false,description:"30–40 fully edited, high-res commercial images. Covers: building exterior, glass façade detail, workshop floor, equipment bays, offices, loading bay, and key architectural details. Delivered as web + print-ready JPGs."},
    {id:5,name:"Aerial Photography",category:"Drone",price:"250",included:false,strikePrice:true,description:"10–15 edited aerial stills from DJI Air 2. Overhead, 45° angle, and low-altitude perspective shots of the building and site. Delivered alongside ground photos."},
    {id:6,name:"Ambient & VO-Ready Audio",category:"Audio",price:"",included:true,strikePrice:false,description:"Clean location audio captured with shotgun mic on C70 rig. Option for client/staff interview or voiceover recording on-site using lav + wireless mic system. Mixed into final film."},
    {id:7,name:"Labour (3 Hours)",category:"Other",price:"600",included:false,strikePrice:true,description:"Single operator, 3 hours on location. Camera setup, lighting, gimbal operation, drone flights, and on-site direction."},
    {id:8,name:"Post-Production & Delivery",category:"Other",price:"",included:true,strikePrice:false,description:"Full edit, colour grade (video), photo retouching, audio mix, and export to final delivery formats. Includes 1 round of client revisions. Delivery via private online gallery / WeTransfer. Turnaround: 7–10 business days."},
  ]);

  const upd=(k,v)=>setForm(f=>({...f,[k]:v}));
  const updItem=(id,k,v)=>setItems(its=>its.map(i=>i.id===id?{...i,[k]:v}:i));
  const addItem=()=>setItems(its=>[...its,{id:_id++,name:"",category:"Video",description:"",price:"",included:false,strikePrice:false}]);
  const removeItem=id=>{if(items.length>1)setItems(its=>its.filter(i=>i.id!==id));};

  // ── FIXED: normalise logo to PNG before storing ──
  const handleLogo = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setLogoError("");
    try {
      const pngDataUrl = await normaliseImageToPng(f);
      setLogoUrl(pngDataUrl);
    } catch (err) {
      setLogoError("Could not load image: " + (err.message || "unknown error"));
      setLogoUrl(null);
    }
  };

  const calcTotals=()=>{
    const sub=items.reduce((s,i)=>(i.included||i.strikePrice)?s:s+(parseFloat(i.price)||0),0);
    const disc=parseFloat(form.discount)||0;
    const exGst=sub-disc;
    const gstAmt=form.gst?exGst*0.1:0;
    return{sub,disc,exGst,gstAmt,total:exGst+gstAmt};
  };
  const totals=calcTotals();

  // ── BUILD QUOTE PDF ──
  const buildQuotePDF=async()=>{
    setPdfStatus("loading");setPdfError("");setPdfDataUrl(null);
    try{
      await loadJsPDF();
      const{jsPDF}=window.jspdf;
      const doc=new jsPDF({orientation:"portrait",unit:"mm",format:"a4"});
      const W=210,H=297,mg=14,cW=182;
      const t=calcTotals();
      const today=new Date().toLocaleDateString("en-AU",{day:"numeric",month:"long",year:"numeric"});
      pdfHeader(doc,logoUrl,form.project||"Production","QUOTE",form.quoteNum,today,"Valid "+form.validDays+" days",W,mg);
      let y=58;
      y=pdfBriefGrid(doc,[{label:"CLIENT",val:form.client||"—"},{label:"PROJECT",val:form.project||"—"},{label:"LOCATION",val:form.location||"—"},{label:"SHOOT",val:form.shoot||"—"}],y,mg,cW);
      const secHead=(title)=>{
        doc.setFont("helvetica","bold");doc.setFontSize(11);doc.setTextColor(30,30,30);doc.text(title,mg,y+5);
        doc.setDrawColor(200,146,42);doc.setLineWidth(0.8);doc.line(mg,y+7,W-mg,y+7);y+=12;
      };
      secHead("01  DELIVERABLES");
      doc.setFillColor(30,30,30);doc.rect(mg,y,cW,7,"F");
      doc.setFont("helvetica","normal");doc.setFontSize(6);doc.setTextColor(255,255,255);
      doc.text("ITEM",mg+3,y+4.5);doc.text("DESCRIPTION",mg+55,y+4.5);doc.text("RATE",W-mg-3,y+4.5,{align:"right"});
      y+=7;
      items.forEach((item,idx)=>{
        const dL=doc.splitTextToSize(item.description||"",80);
        const rH=Math.max(12,8+dL.length*3.5);
        if(y+rH>H-30){doc.addPage();y=14;}
        doc.setFillColor(idx%2===0?252:255,idx%2===0?250:255,idx%2===0?246:255);
        doc.rect(mg,y,cW,rH,"F");
        doc.setDrawColor(225,218,208);doc.setLineWidth(0.2);doc.line(mg,y+rH,W-mg,y+rH);
        const col=CAT_COLORS[item.category]||[136,136,136];
        doc.setFillColor(col[0],col[1],col[2]);doc.roundedRect(mg+2,y+2.5,14,4,0.8,0.8,"F");
        doc.setFont("helvetica","bold");doc.setFontSize(5);doc.setTextColor(255,255,255);
        doc.text(item.category.toUpperCase(),mg+9,y+5.3,{align:"center"});
        doc.setFont("helvetica","bold");doc.setFontSize(8);doc.setTextColor(30,30,30);
        doc.text(item.name||"",mg+18,y+6);
        doc.setFont("helvetica","normal");doc.setFontSize(6.5);doc.setTextColor(120,120,120);
        dL.forEach((line,li)=>doc.text(line,mg+55,y+5+li*3.5));
        doc.setFont("helvetica","bold");doc.setFontSize(8);
        if(item.included){doc.setTextColor(200,146,42);doc.text("Included",W-mg-3,y+6,{align:"right"});}
        else if(item.strikePrice){
          const sp=fmtP0(item.price);doc.setTextColor(180,180,180);doc.setFontSize(7);
          doc.text(sp,W-mg-3,y+5,{align:"right"});
          const sw=doc.getTextWidth(sp);doc.setDrawColor(180,180,180);doc.setLineWidth(0.4);
          doc.line(W-mg-3-sw,y+4.2,W-mg-3,y+4.2);
          doc.setTextColor(200,146,42);doc.setFontSize(6.5);doc.text("Included",W-mg-3,y+9,{align:"right"});
        }else{doc.setTextColor(30,30,30);doc.text(item.price?fmtP0(item.price):"—",W-mg-3,y+6,{align:"right"});}
        y+=rH;
      });
      y+=5;
      if(form.notes){
        if(y+20>H-30){doc.addPage();y=14;}
        const nl=doc.splitTextToSize(form.notes,cW-8);const nh=nl.length*3.8+10;
        doc.setFillColor(255,255,255);doc.setDrawColor(210,200,185);doc.setLineWidth(0.3);doc.rect(mg,y,cW,nh,"FD");
        doc.setFillColor(200,146,42);doc.rect(mg,y,2.5,nh,"F");
        doc.setFont("helvetica","bold");doc.setFontSize(6);doc.setTextColor(200,146,42);doc.text("INCLUSIONS & NOTES",mg+5,y+5);
        doc.setFont("helvetica","normal");doc.setFontSize(7);doc.setTextColor(80,80,80);
        nl.forEach((l,i)=>doc.text(l,mg+5,y+9+i*3.8));y+=nh+5;
      }
      if(y+40>H-30){doc.addPage();y=14;}
      const totW=78,totX=W-mg-totW;let ty=y;
      items.filter(i=>!i.included&&!i.strikePrice&&i.price).forEach(i=>{
        doc.setFillColor(30,30,30);doc.rect(totX,ty,totW,6,"F");
        doc.setFont("helvetica","normal");doc.setFontSize(6.5);doc.setTextColor(160,160,160);
        doc.text(i.name,totX+3,ty+4);doc.text(fmtP0(i.price),totX+totW-3,ty+4,{align:"right"});ty+=6;
      });
      if(t.disc>0){
        doc.setFillColor(30,30,30);doc.rect(totX,ty,totW,6,"F");
        doc.setFont("helvetica","normal");doc.setFontSize(6.5);doc.setTextColor(200,146,42);
        doc.text(form.discLabel,totX+3,ty+4);doc.text("−"+fmtP0(t.disc),totX+totW-3,ty+4,{align:"right"});ty+=6;
      }
      doc.setFillColor(30,30,30);doc.rect(totX,ty,totW,11,"F");
      doc.setDrawColor(200,146,42);doc.setLineWidth(0.6);doc.line(totX,ty,totX+totW,ty);
      doc.setFont("helvetica","bold");doc.setFontSize(7.5);doc.setTextColor(255,255,255);doc.text("TOTAL (EX. GST)",totX+3,ty+5);
      doc.setFontSize(10);doc.setTextColor(232,184,64);doc.text(fmtP0(t.exGst),totX+totW-3,ty+8,{align:"right"});ty+=11;
      if(form.gst){
        doc.setFillColor(30,30,30);doc.rect(totX,ty,totW,6,"F");
        doc.setFont("helvetica","normal");doc.setFontSize(6.5);doc.setTextColor(150,150,150);
        doc.text("GST (10%)",totX+3,ty+4);doc.text(fmtP0(t.gstAmt),totX+totW-3,ty+4,{align:"right"});ty+=6;
        doc.setFillColor(30,30,30);doc.rect(totX,ty,totW,7,"F");
        doc.setFont("helvetica","bold");doc.setFontSize(7.5);doc.setTextColor(255,255,255);
        doc.text("TOTAL INC. GST",totX+3,ty+4.5);doc.text(fmtP0(t.total),totX+totW-3,ty+4.5,{align:"right"});ty+=7;
      }
      doc.setFillColor(30,30,30);doc.rect(totX,ty,totW,5,"F");
      doc.setFont("helvetica","normal");doc.setFontSize(5);doc.setTextColor(100,100,100);
      doc.text("50% deposit on booking · ABN required",totX+3,ty+3.5);
      y=Math.max(y+55,ty+10);
      if(y+40>H-30){doc.addPage();y=14;}
      secHead("02  TERMS");
      [[form.payment,"PAYMENT"],[form.cancel,"CANCELLATION"],[form.usage,"LICENSING & USAGE"]].forEach(([txt,ttl])=>{
        if(!txt)return;if(y+20>H-30){doc.addPage();y=14;}
        const tl=doc.splitTextToSize(txt,cW-8);const th=tl.length*3.8+10;
        doc.setFillColor(255,255,255);doc.setDrawColor(210,200,185);doc.setLineWidth(0.3);doc.rect(mg,y,cW,th,"FD");
        doc.setFont("helvetica","bold");doc.setFontSize(6);doc.setTextColor(150,150,150);doc.text(ttl,mg+4,y+5);
        doc.setFont("helvetica","normal");doc.setFontSize(7);doc.setTextColor(60,60,60);
        tl.forEach((l,i)=>doc.text(l,mg+4,y+9+i*3.8));y+=th+4;
      });
      pdfFooter(doc,{name:form.contactName,phone:form.phone,email:form.email},H,mg,W);
      const fname=`Quote-${(form.client||"Client").replace(/\s+/g,"-")}-${form.quoteNum}.pdf`;
      setPdfDataUrl(doc.output("datauristring"));setPdfFilename(fname);setPdfStatus("ready");
    }catch(err){setPdfError(err.message||"Unknown error");setPdfStatus("error");}
  };

  // ── BUILD INVOICE PDF ──
  const buildInvoicePDF=async()=>{
    setInvStatus("loading");setInvError("");setInvDataUrl(null);
    try{
      await loadJsPDF();
      const{jsPDF}=window.jspdf;
      const doc=new jsPDF({orientation:"portrait",unit:"mm",format:"a4"});
      const W=210,H=297,mg=14,cW=182;
      const t=calcTotals();
      const depositAmt=t.total*0.5;
      const balanceAmt=t.total*0.5;
      const paid=parseFloat(amtPaid)||0;
      const balance=t.total-paid;
      const today=new Date().toLocaleDateString("en-AU",{day:"numeric",month:"long",year:"numeric"});

      pdfHeader(doc,logoUrl,form.project||"Production","TAX INVOICE",invNum,today,invDue?"Due: "+invDue:null,W,mg);
      let y=58;

      y=pdfBriefGrid(doc,[
        {label:"BILL TO",val:form.client||"—"},
        {label:"PROJECT",val:form.project||"—"},
        {label:"INVOICE DATE",val:invDate||today},
        {label:"ABN",val:invABN||"—"}
      ],y,mg,cW);

      doc.setFont("helvetica","bold");doc.setFontSize(11);doc.setTextColor(30,30,30);
      doc.text("01  LINE ITEMS",mg,y+5);
      doc.setDrawColor(200,146,42);doc.setLineWidth(0.8);doc.line(mg,y+7,W-mg,y+7);y+=12;

      doc.setFillColor(30,30,30);doc.rect(mg,y,cW,7,"F");
      doc.setFont("helvetica","normal");doc.setFontSize(6);doc.setTextColor(255,255,255);
      doc.text("ITEM",mg+3,y+4.5);doc.text("DESCRIPTION",mg+60,y+4.5);doc.text("RATE",W-mg-3,y+4.5,{align:"right"});
      y+=7;

      const billable=items.filter(i=>!i.included&&!i.strikePrice&&i.price);
      billable.forEach((item,idx)=>{
        const dL=doc.splitTextToSize(item.description||"",75);
        const rH=Math.max(14,8+dL.length*3.5);
        if(y+rH>H-40){doc.addPage();y=14;}
        doc.setFillColor(idx%2===0?252:255,idx%2===0?250:255,idx%2===0?246:255);
        doc.rect(mg,y,cW,rH,"F");
        doc.setDrawColor(225,218,208);doc.setLineWidth(0.2);doc.line(mg,y+rH,W-mg,y+rH);
        const col=CAT_COLORS[item.category]||[136,136,136];
        doc.setFillColor(col[0],col[1],col[2]);doc.roundedRect(mg+2,y+2.5,14,4,0.8,0.8,"F");
        doc.setFont("helvetica","bold");doc.setFontSize(5);doc.setTextColor(255,255,255);
        doc.text(item.category.toUpperCase(),mg+9,y+5.3,{align:"center"});
        doc.setFont("helvetica","bold");doc.setFontSize(8);doc.setTextColor(30,30,30);
        doc.text(item.name||"",mg+18,y+6);
        doc.setFont("helvetica","normal");doc.setFontSize(6.5);doc.setTextColor(120,120,120);
        dL.forEach((line,li)=>doc.text(line,mg+60,y+5+li*3.5));
        doc.setFont("helvetica","bold");doc.setFontSize(8);doc.setTextColor(30,30,30);
        doc.text(fmtP(item.price),W-mg-3,y+6,{align:"right"});
        y+=rH;
      });
      y+=6;

      if(y+80>H-40){doc.addPage();y=14;}
      doc.setFont("helvetica","bold");doc.setFontSize(11);doc.setTextColor(30,30,30);
      doc.text("02  PAYMENT SCHEDULE",mg,y+5);
      doc.setDrawColor(200,146,42);doc.setLineWidth(0.8);doc.line(mg,y+7,W-mg,y+7);y+=12;

      doc.setFillColor(245,255,245);doc.setDrawColor(180,220,180);doc.setLineWidth(0.3);
      doc.rect(mg,y,cW/2-2,32,"FD");
      doc.setFont("helvetica","bold");doc.setFontSize(7);doc.setTextColor(40,120,40);
      doc.text("DEPOSIT — 50%",mg+4,y+6);
      doc.setFont("helvetica","normal");doc.setFontSize(6.5);doc.setTextColor(60,60,60);
      doc.text("Due before shoot date",mg+4,y+12);
      if(t.disc>0){doc.setTextColor(150,150,150);doc.setFontSize(6);doc.text("Subtotal: "+fmtP(t.total),mg+4,y+18);}
      doc.setFont("helvetica","bold");doc.setFontSize(11);doc.setTextColor(30,30,30);
      doc.text(fmtP(depositAmt),mg+4,y+26);

      const bx=mg+cW/2+2;
      doc.setFillColor(255,245,245);doc.setDrawColor(220,180,180);doc.setLineWidth(0.3);
      doc.rect(bx,y,cW/2-2,32,"FD");
      doc.setFont("helvetica","bold");doc.setFontSize(7);doc.setTextColor(150,40,40);
      doc.text("FINAL BALANCE — 50%",bx+4,y+6);
      doc.setFont("helvetica","normal");doc.setFontSize(6.5);doc.setTextColor(60,60,60);
      doc.text("Due on final delivery",bx+4,y+12);
      doc.setFont("helvetica","bold");doc.setFontSize(11);doc.setTextColor(30,30,30);
      doc.text(fmtP(balanceAmt),bx+4,y+26);
      y+=38;

      const totW=90,totX=W-mg-totW;
      if(y+60>H-40){doc.addPage();y=14;}
      let ty=y;
      billable.forEach(i=>{
        doc.setFillColor(30,30,30);doc.rect(totX,ty,totW,6,"F");
        doc.setFont("helvetica","normal");doc.setFontSize(6.5);doc.setTextColor(160,160,160);
        doc.text(i.name,totX+3,ty+4);doc.text(fmtP(i.price),totX+totW-3,ty+4,{align:"right"});ty+=6;
      });
      if(t.disc>0){
        doc.setFillColor(30,30,30);doc.rect(totX,ty,totW,6,"F");
        doc.setTextColor(200,146,42);doc.setFontSize(6.5);
        doc.text(form.discLabel,totX+3,ty+4);doc.text("−"+fmtP(t.disc),totX+totW-3,ty+4,{align:"right"});ty+=6;
      }
      doc.setFillColor(30,30,30);doc.rect(totX,ty,totW,7,"F");
      doc.setFont("helvetica","normal");doc.setFontSize(6.5);doc.setTextColor(150,150,150);
      doc.text("Subtotal (ex. GST)",totX+3,ty+4.5);doc.text(fmtP(t.exGst),totX+totW-3,ty+4.5,{align:"right"});ty+=7;
      if(t.gstAmt>0){
        doc.setFillColor(30,30,30);doc.rect(totX,ty,totW,6,"F");
        doc.setTextColor(150,150,150);doc.setFontSize(6.5);
        doc.text("GST (10%)",totX+3,ty+4);doc.text(fmtP(t.gstAmt),totX+totW-3,ty+4,{align:"right"});ty+=6;
      }
      doc.setFillColor(30,30,30);doc.rect(totX,ty,totW,11,"F");
      doc.setDrawColor(200,146,42);doc.setLineWidth(0.6);doc.line(totX,ty,totX+totW,ty);
      doc.setFont("helvetica","bold");doc.setFontSize(7.5);doc.setTextColor(255,255,255);
      doc.text("TOTAL (INC. GST)",totX+3,ty+5);
      doc.setFontSize(10);doc.setTextColor(232,184,64);
      doc.text(fmtP(t.total),totX+totW-3,ty+8,{align:"right"});ty+=11;

      const statusColors={none:[30,30,30],deposit:[20,60,20],partial:[60,50,10],full:[10,60,10]};
      const statusLabels={none:"AWAITING PAYMENT",deposit:"DEPOSIT PAID",partial:"PARTIAL PAYMENT RECEIVED",full:"PAID IN FULL"};
      const sc=statusColors[paidStatus]||[30,30,30];
      doc.setFillColor(sc[0],sc[1],sc[2]);doc.rect(totX,ty,totW,8,"F");
      doc.setFont("helvetica","bold");doc.setFontSize(7);
      const sLabel=statusLabels[paidStatus]||"AWAITING PAYMENT";
      const sColors={none:[180,100,100],deposit:[100,200,100],partial:[200,180,80],full:[80,220,80]};
      const sc2=sColors[paidStatus]||[180,100,100];
      doc.setTextColor(sc2[0],sc2[1],sc2[2]);
      doc.text(sLabel,totX+3,ty+5);ty+=8;
      if(paid>0){
        doc.setFillColor(30,30,30);doc.rect(totX,ty,totW,6,"F");
        doc.setFont("helvetica","normal");doc.setFontSize(6.5);doc.setTextColor(150,200,150);
        doc.text("Amount paid",totX+3,ty+4);doc.text(fmtP(paid),totX+totW-3,ty+4,{align:"right"});ty+=6;
        if(paidStatus!=="full"){
          doc.setFillColor(50,20,20);doc.rect(totX,ty,totW,8,"F");
          doc.setDrawColor(180,80,80);doc.setLineWidth(0.4);doc.line(totX,ty,totX+totW,ty);
          doc.setFont("helvetica","bold");doc.setFontSize(8);doc.setTextColor(220,120,120);
          doc.text("BALANCE OWING",totX+3,ty+5.5);doc.text(fmtP(balance),totX+totW-3,ty+5.5,{align:"right"});ty+=8;
        }
      }
      y=Math.max(y+50,ty+8);

      if(y+45>H-40){doc.addPage();y=14;}
      doc.setFont("helvetica","bold");doc.setFontSize(11);doc.setTextColor(30,30,30);
      doc.text("03  PAYMENT DETAILS",mg,y+5);
      doc.setDrawColor(200,146,42);doc.setLineWidth(0.8);doc.line(mg,y+7,W-mg,y+7);y+=12;

      const payFields=[
        {label:"ACCOUNT NAME",val:invAcctName||form.contactName||"—"},
        {label:"BANK",val:invBankName||"—"},
        {label:"BSB",val:invBSB||"—"},
        {label:"ACCOUNT NUMBER",val:invAcct||"—"},
      ];
      const pw=cW/2;
      doc.setFillColor(255,255,255);doc.setDrawColor(210,200,185);doc.setLineWidth(0.3);
      doc.rect(mg,y,cW,32,"FD");
      payFields.forEach((p,i)=>{
        const cx=i%2===0?mg:mg+pw;
        const py=y+5+Math.floor(i/2)*14;
        doc.setFont("helvetica","normal");doc.setFontSize(5.5);doc.setTextColor(150,150,150);doc.text(p.label,cx+4,py);
        doc.setFont("helvetica","bold");doc.setFontSize(8);doc.setTextColor(30,30,30);doc.text(p.val,cx+4,py+6);
      });
      y+=36;

      if(invNote){
        if(y+20>H-30){doc.addPage();y=14;}
        const nl=doc.splitTextToSize(invNote,cW-8);const nh=nl.length*3.8+10;
        doc.setFillColor(255,255,255);doc.setDrawColor(210,200,185);doc.setLineWidth(0.3);doc.rect(mg,y,cW,nh,"FD");
        doc.setFillColor(200,146,42);doc.rect(mg,y,2.5,nh,"F");
        doc.setFont("helvetica","bold");doc.setFontSize(6);doc.setTextColor(200,146,42);doc.text("NOTES",mg+5,y+5);
        doc.setFont("helvetica","normal");doc.setFontSize(7);doc.setTextColor(80,80,80);
        nl.forEach((l,i)=>doc.text(l,mg+5,y+9+i*3.8));y+=nh+5;
      }

      pdfFooter(doc,{name:form.contactName,phone:form.phone,email:form.email},H,mg,W);

      const fname=`Invoice-${(form.client||"Client").replace(/\s+/g,"-")}-${invNum}.pdf`;
      setInvDataUrl(doc.output("datauristring"));setInvFilename(fname);setInvStatus("ready");
    }catch(err){setInvError(err.message||"Unknown error");setInvStatus("error");}
  };

  const TABS=["Details","Items","Pricing","Contact","🧾 Invoice"];

  return(
    <div style={{background:DARK,minHeight:"100vh",fontFamily:"system-ui,sans-serif",color:"#eee"}}>

      {screen==="form"&&<>
        <div style={{display:"flex",background:DARK,borderBottom:`1px solid ${BORDER}`,position:"sticky",top:0,zIndex:100,overflowX:"auto"}}>
          {TABS.map((t,i)=>(
            <button key={t} onClick={()=>setTab(i)} style={{flex:"0 0 auto",padding:"0.85rem 0.6rem",fontSize:"0.58rem",letterSpacing:"0.08em",textTransform:"uppercase",fontFamily:"monospace",border:"none",background:"none",cursor:"pointer",whiteSpace:"nowrap",color:tab===i?GOLD:MUTED,borderBottom:tab===i?`2px solid ${GOLD}`:"2px solid transparent"}}>{t}</button>
          ))}
        </div>

        <div style={{padding:"1.25rem",paddingBottom:"5.5rem"}}>

          {tab===0&&<>
            <div style={secLbl}>Your Logo</div>
            <label style={{border:`2px dashed ${BORDER}`,borderRadius:8,padding:"1.25rem",textAlign:"center",cursor:"pointer",display:"block",marginBottom:"0.75rem"}}>
              <input type="file" accept="image/*" onChange={handleLogo} style={{position:"absolute",width:1,height:1,opacity:0,pointerEvents:"none"}}/>
              {logoUrl?<img src={logoUrl} style={{maxHeight:60,maxWidth:"100%",objectFit:"contain"}}/>
                :<><div style={{fontSize:"1.8rem"}}>📁</div><div style={{fontFamily:"monospace",fontSize:"0.62rem",letterSpacing:"0.1em",color:MUTED,marginTop:"0.4rem"}}>Tap to upload logo</div><div style={{fontSize:"0.68rem",color:"#555",marginTop:"0.2rem"}}>JPG, PNG, WebP</div></>}
            </label>
            {logoError&&<div style={{background:"#1a0808",border:`1px solid #4a1515`,borderRadius:6,padding:"0.6rem 0.8rem",color:"#e07070",fontSize:"0.78rem",marginBottom:"0.75rem"}}>⚠️ {logoError}</div>}
            {logoUrl&&<button onClick={()=>setLogoUrl(null)} style={{display:"block",width:"100%",background:"none",border:`1px solid ${BORDER}`,borderRadius:6,color:MUTED,fontSize:"0.68rem",fontFamily:"monospace",padding:"0.45rem",cursor:"pointer",marginBottom:"0.75rem"}}>✕ Remove logo</button>}
            <div style={secLbl}>Project Details</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.6rem"}}>
              <Field label="Quote Number"><input style={inp} value={form.quoteNum} onChange={e=>upd("quoteNum",e.target.value)}/></Field>
              <Field label="Valid (days)"><input style={inp} type="number" value={form.validDays} onChange={e=>upd("validDays",e.target.value)}/></Field>
            </div>
            <Field label="Client Name / Business"><input style={inp} value={form.client} onChange={e=>upd("client",e.target.value)} placeholder="e.g. Mackay Generator Hire"/></Field>
            <Field label="Project Name"><input style={inp} value={form.project} onChange={e=>upd("project",e.target.value)} placeholder="e.g. Workshop Reveal"/></Field>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.6rem"}}>
              <Field label="Location"><input style={inp} value={form.location} onChange={e=>upd("location",e.target.value)}/></Field>
              <Field label="Shoot Duration"><input style={inp} value={form.shoot} onChange={e=>upd("shoot",e.target.value)} placeholder="e.g. 3 Hours"/></Field>
            </div>
            <div style={secLbl}>Notes / Inclusions</div>
            <textarea style={{...inp,resize:"none"}} rows={5} value={form.notes} onChange={e=>upd("notes",e.target.value)}/>
          </>}

          {tab===1&&<>
            <div style={secLbl}>Line Items</div>
            {items.map(item=>(
              <div key={item.id} style={{background:DARK2,border:`1px solid ${BORDER}`,borderRadius:8,padding:"0.9rem",marginBottom:"0.6rem"}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:"0.5rem",alignItems:"center",marginBottom:"0.5rem"}}>
                  <input style={{...inp,background:DARK3,fontWeight:500}} placeholder="Item name" value={item.name} onChange={e=>updItem(item.id,"name",e.target.value)}/>
                  <button onClick={()=>removeItem(item.id)} style={{background:"none",border:`1px solid #333`,borderRadius:5,color:"#555",fontSize:"0.7rem",padding:"0.4rem 0.6rem",cursor:"pointer"}}>✕</button>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.5rem",marginBottom:"0.5rem"}}>
                  <select style={{...sel,background:DARK3}} value={item.category} onChange={e=>updItem(item.id,"category",e.target.value)}>
                    {CATS.map(c=><option key={c}>{c}</option>)}
                  </select>
                  <input style={{...inp,background:DARK3}} type="number" placeholder="Price $" value={item.price} onChange={e=>updItem(item.id,"price",e.target.value)}/>
                </div>
                <textarea style={{...inp,background:DARK3,color:"#aaa",fontSize:"0.82rem",resize:"none",marginBottom:"0.5rem"}} rows={2} placeholder="Description" value={item.description} onChange={e=>updItem(item.id,"description",e.target.value)}/>
                <div style={{display:"flex",gap:"1rem"}}>
                  {[["included","Included (free)"],["strikePrice","Strike price"]].map(([k,label])=>(
                    <label key={k} style={{display:"flex",alignItems:"center",gap:"0.4rem",fontSize:"0.75rem",color:MUTED,cursor:"pointer"}}>
                      <input type="checkbox" checked={item[k]} onChange={e=>updItem(item.id,k,e.target.checked)} style={{accentColor:GOLD,width:16,height:16}}/>{label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <button onClick={addItem} style={{width:"100%",background:"none",border:`1px dashed ${BORDER}`,borderRadius:8,color:MUTED,fontFamily:"monospace",fontSize:"0.68rem",letterSpacing:"0.1em",padding:"0.85rem",cursor:"pointer"}}>+ Add Line Item</button>
          </>}

          {tab===2&&<>
            <div style={secLbl}>Discount</div>
            <Field label="Discount Label"><input style={inp} value={form.discLabel} onChange={e=>upd("discLabel",e.target.value)}/></Field>
            <Field label="Discount Amount $"><input style={inp} type="number" value={form.discount} onChange={e=>upd("discount",e.target.value)} placeholder="0"/></Field>
            <div style={secLbl}>GST</div>
            <label style={{display:"flex",alignItems:"center",gap:"0.5rem",fontSize:"0.85rem",color:"#aaa",cursor:"pointer"}}>
              <input type="checkbox" checked={form.gst} onChange={e=>upd("gst",e.target.checked)} style={{accentColor:GOLD,width:18,height:18}}/> Apply GST (10%)
            </label>
            <div style={secLbl}>Running Total</div>
            <div style={{background:DARK2,border:`1px solid ${BORDER}`,borderRadius:8,padding:"1rem"}}>
              {items.filter(i=>!i.included&&!i.strikePrice&&i.price).map(i=>(
                <div key={i.id} style={{display:"flex",justifyContent:"space-between",fontSize:"0.78rem",color:MUTED,paddingBottom:"0.25rem"}}>
                  <span>{i.name||"Unnamed"}</span><span>{fmtP0(i.price)}</span>
                </div>
              ))}
              {totals.disc>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:"0.78rem",color:GOLD,paddingBottom:"0.25rem"}}><span>{form.discLabel}</span><span>−{fmtP0(totals.disc)}</span></div>}
              <div style={{display:"flex",justifyContent:"space-between",fontWeight:700,borderTop:`1px solid ${BORDER}`,paddingTop:"0.5rem",marginTop:"0.25rem"}}>
                <span style={{fontSize:"0.85rem"}}>Ex. GST</span><span style={{color:GOLD}}>{fmtP0(totals.exGst)}</span>
              </div>
              {form.gst&&<div style={{display:"flex",justifyContent:"space-between",fontSize:"0.82rem",paddingTop:"0.25rem"}}><span style={{color:MUTED}}>Inc. GST</span><span style={{color:"#fff",fontWeight:600}}>{fmtP0(totals.total)}</span></div>}
              {form.gst&&<div style={{display:"flex",justifyContent:"space-between",fontSize:"0.78rem",paddingTop:"0.4rem",borderTop:`1px solid ${BORDER}`,marginTop:"0.4rem"}}>
                <span style={{color:MUTED}}>50% Deposit</span><span style={{color:"#e8b840",fontWeight:600}}>{fmtP(totals.total*0.5)}</span>
              </div>}
            </div>
            <div style={secLbl}>Terms</div>
            <Field label="Payment Terms"><textarea style={{...inp,resize:"none"}} rows={3} value={form.payment} onChange={e=>upd("payment",e.target.value)}/></Field>
            <Field label="Cancellation Policy"><textarea style={{...inp,resize:"none"}} rows={3} value={form.cancel} onChange={e=>upd("cancel",e.target.value)}/></Field>
            <Field label="Licensing & Usage"><textarea style={{...inp,resize:"none"}} rows={3} value={form.usage} onChange={e=>upd("usage",e.target.value)}/></Field>
          </>}

          {tab===3&&<>
            <div style={secLbl}>Your Details</div>
            <Field label="Your Name"><input style={inp} value={form.contactName} onChange={e=>upd("contactName",e.target.value)} placeholder="Riley Battese"/></Field>
            <Field label="Phone"><input style={inp} type="tel" value={form.phone} onChange={e=>upd("phone",e.target.value)} placeholder="04xx xxx xxx"/></Field>
            <Field label="Email"><input style={inp} type="email" value={form.email} onChange={e=>upd("email",e.target.value)} placeholder="riley@unwrittenfilmsau.com"/></Field>
            <Field label="Website (optional)"><input style={inp} value={form.web} onChange={e=>upd("web",e.target.value)} placeholder="www.unwrittenfilms.com.au"/></Field>
          </>}

          {tab===4&&<>
            <div style={secLbl}>Invoice Details</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.6rem"}}>
              <Field label="Invoice Number"><input style={inp} value={invNum} onChange={e=>setInvNum(e.target.value)}/></Field>
              <Field label="Invoice Date"><input style={inp} value={invDate} onChange={e=>setInvDate(e.target.value)}/></Field>
            </div>
            <Field label="Payment Due Date (optional)"><input style={inp} value={invDue} onChange={e=>setInvDue(e.target.value)} placeholder="e.g. 18 May 2026"/></Field>
            <Field label="Your ABN"><input style={inp} value={invABN} onChange={e=>setInvABN(e.target.value)} placeholder="e.g. 12 345 678 901"/></Field>

            <div style={secLbl}>Bank Details</div>
            <Field label="Account Name"><input style={inp} value={invAcctName} onChange={e=>setInvAcctName(e.target.value)} placeholder="e.g. Riley Battese"/></Field>
            <Field label="Bank"><input style={inp} value={invBankName} onChange={e=>setInvBankName(e.target.value)} placeholder="e.g. Commonwealth Bank"/></Field>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.6rem"}}>
              <Field label="BSB"><input style={inp} value={invBSB} onChange={e=>setInvBSB(e.target.value)} placeholder="xxx-xxx"/></Field>
              <Field label="Account Number"><input style={inp} value={invAcct} onChange={e=>setInvAcct(e.target.value)} placeholder="xxxxxxxxx"/></Field>
            </div>

            <div style={secLbl}>Payment Status</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.5rem",marginBottom:"0.75rem"}}>
              {[["none","⏳ Awaiting","#555","#333"],["deposit","💰 Deposit Paid","#3a7a3a","#0d200d"],["partial","⚡ Part Paid","#7a6a10","#201a00"],["full","✅ Paid in Full","#1a7a1a","#0a200a"]].map(([val,label,border,bg])=>(
                <button key={val} onClick={()=>{setPaidStatus(val);}} style={{padding:"0.75rem 0.5rem",borderRadius:8,border:`2px solid ${paidStatus===val?border:BORDER}`,background:paidStatus===val?bg:DARK2,color:paidStatus===val?"#eee":MUTED,fontWeight:paidStatus===val?700:400,fontSize:"0.78rem",cursor:"pointer",textAlign:"center"}}>
                  {label}
                </button>
              ))}
            </div>
            {(paidStatus==="deposit"||paidStatus==="partial")&&(
              <Field label="Amount Paid $">
                <input style={inp} type="number" value={amtPaid} onChange={e=>setAmtPaid(e.target.value)} placeholder={paidStatus==="deposit"?fmtP(totals.total*0.5).replace("$",""):"0.00"}/>
              </Field>
            )}
            {paidStatus!=="none"&&(
              <div style={{background:DARK2,border:`1px solid ${BORDER}`,borderRadius:8,padding:"0.85rem",marginBottom:"0.5rem"}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:"0.82rem",paddingBottom:"0.25rem"}}><span style={{color:MUTED}}>Total</span><span style={{color:GOLD,fontWeight:600}}>{fmtP(totals.total)}</span></div>
                {(paidStatus==="deposit"||paidStatus==="partial")&&amtPaid&&<div style={{display:"flex",justifyContent:"space-between",fontSize:"0.82rem",paddingBottom:"0.25rem"}}><span style={{color:"#90d090"}}>Paid</span><span style={{color:"#90d090",fontWeight:600}}>{fmtP(amtPaid)}</span></div>}
                {paidStatus!=="full"&&amtPaid&&<div style={{display:"flex",justifyContent:"space-between",fontSize:"0.88rem",borderTop:`1px solid ${BORDER}`,paddingTop:"0.25rem",marginTop:"0.1rem"}}><span style={{color:"#e07070",fontWeight:700}}>Balance Owing</span><span style={{color:"#e07070",fontWeight:700}}>{fmtP(totals.total-(parseFloat(amtPaid)||0))}</span></div>}
                {paidStatus==="full"&&<div style={{fontSize:"0.82rem",color:"#70e070",textAlign:"center",marginTop:"0.25rem",fontWeight:600}}>🎉 Fully Paid</div>}
              </div>
            )}

            <div style={secLbl}>Additional Notes (optional)</div>
            <textarea style={{...inp,resize:"none"}} rows={3} value={invNote} onChange={e=>setInvNote(e.target.value)} placeholder="e.g. Please use invoice number as payment reference"/>

            <div style={{marginTop:"1.25rem"}}>
              {invStatus==="idle"&&<button onClick={buildInvoicePDF} style={{width:"100%",background:"#1a3a1a",border:`1px solid #2a5a2a`,borderRadius:8,color:"#90d090",fontWeight:700,fontSize:"0.95rem",padding:"1rem",cursor:"pointer"}}>
                ⚙️ Build Invoice PDF
              </button>}
              {invStatus==="loading"&&<div style={{background:DARK2,borderRadius:8,padding:"1rem",textAlign:"center",color:GOLD,fontFamily:"monospace",fontSize:"0.8rem",letterSpacing:"0.1em"}}>⏳ Building invoice...</div>}
              {invStatus==="error"&&<div style={{background:"#1a0808",border:`1px solid #4a1515`,borderRadius:8,padding:"1rem"}}>
                <div style={{color:"#e07070",fontWeight:600,marginBottom:"0.35rem"}}>❌ {invError}</div>
                <button onClick={buildInvoicePDF} style={{background:"none",border:`1px solid #4a1515`,borderRadius:6,color:"#e07070",padding:"0.45rem 0.9rem",cursor:"pointer",fontSize:"0.8rem"}}>Try Again</button>
              </div>}
              {invStatus==="ready"&&invDataUrl&&<div style={{background:"#0a1a0a",border:`1px solid #1a4a1a`,borderRadius:8,padding:"1rem",textAlign:"center"}}>
                <div style={{color:"#70e070",fontWeight:600,marginBottom:"0.5rem"}}>✅ Invoice Ready!</div>
                <a href={invDataUrl} download={invFilename} style={{display:"inline-block",background:"#2a6a2a",borderRadius:8,color:"#fff",fontWeight:700,fontSize:"1rem",padding:"0.85rem 2rem",cursor:"pointer",textDecoration:"none"}}>
                  ⬇ Download Invoice
                </a>
                <div style={{fontSize:"0.7rem",color:MUTED,marginTop:"0.6rem",fontFamily:"monospace"}}>Long-press if download doesn't start</div>
                <button onClick={()=>{setInvStatus("idle");setInvDataUrl(null);}} style={{display:"block",width:"100%",marginTop:"0.5rem",background:"none",border:`1px solid ${BORDER}`,borderRadius:6,color:MUTED,fontSize:"0.7rem",padding:"0.5rem",cursor:"pointer",fontFamily:"monospace"}}>Rebuild</button>
              </div>}
            </div>
          </>}
        </div>

        <button onClick={()=>{setScreen("preview");setPdfStatus("idle");setPdfDataUrl(null);}} style={{position:"fixed",bottom:0,left:0,right:0,background:GOLD,border:"none",color:"#000",fontWeight:700,fontSize:"1.1rem",letterSpacing:"0.06em",padding:"1.1rem",cursor:"pointer",zIndex:200}}>
          ⚡ Generate Quote
        </button>
      </>}

      {screen==="preview"&&(
        <div style={{padding:"1.25rem",paddingBottom:"2rem"}}>
          {pdfStatus==="idle"&&<button onClick={buildQuotePDF} style={{width:"100%",background:GOLD,border:"none",borderRadius:8,color:"#000",fontWeight:700,fontSize:"1rem",padding:"1rem",cursor:"pointer",marginBottom:"0.6rem"}}>⚙️ Step 1: Build PDF</button>}
          {pdfStatus==="loading"&&<div style={{background:DARK2,borderRadius:8,padding:"1.25rem",textAlign:"center",marginBottom:"0.6rem",color:GOLD,fontFamily:"monospace",fontSize:"0.8rem",letterSpacing:"0.1em"}}>⏳ Building PDF...</div>}
          {pdfStatus==="error"&&<div style={{background:"#1a0808",border:`1px solid #4a1515`,borderRadius:8,padding:"1rem",marginBottom:"0.6rem"}}>
            <div style={{color:"#e07070",fontWeight:600,marginBottom:"0.35rem"}}>❌ {pdfError}</div>
            <button onClick={buildQuotePDF} style={{background:"none",border:`1px solid #4a1515`,borderRadius:6,color:"#e07070",padding:"0.45rem 0.9rem",cursor:"pointer",fontSize:"0.8rem"}}>Try Again</button>
          </div>}
          {pdfStatus==="ready"&&pdfDataUrl&&<div style={{background:"#0a1a0a",border:`1px solid #1a4a1a`,borderRadius:8,padding:"1rem",marginBottom:"0.6rem",textAlign:"center"}}>
            <div style={{color:"#70e070",fontWeight:600,marginBottom:"0.5rem"}}>✅ PDF Ready!</div>
            <a href={pdfDataUrl} download={pdfFilename} style={{display:"inline-block",background:GOLD,borderRadius:8,color:"#000",fontWeight:700,fontSize:"1rem",padding:"0.85rem 2rem",cursor:"pointer",textDecoration:"none"}}>⬇ Download Quote PDF</a>
            <div style={{fontSize:"0.7rem",color:MUTED,marginTop:"0.6rem",fontFamily:"monospace"}}>Long-press if download doesn't start</div>
          </div>}

          <button onClick={()=>setScreen("form")} style={{width:"100%",background:"none",border:`1px solid ${BORDER}`,borderRadius:8,color:MUTED,fontFamily:"monospace",fontSize:"0.68rem",letterSpacing:"0.1em",padding:"0.85rem",cursor:"pointer",textTransform:"uppercase",marginBottom:"1.25rem"}}>← Edit Quote</button>

          <div style={{background:"#f5f2ed",borderRadius:8,overflow:"hidden",color:"#0f0f0f"}}>
            <div style={{background:"#1e1e1e",padding:"1.25rem"}}>
              {logoUrl?<img src={logoUrl} style={{height:40,objectFit:"contain",maxWidth:180,marginBottom:"0.6rem",display:"block"}}/>
                :<div style={{fontWeight:700,fontSize:"1.2rem",color:"#fff",marginBottom:"0.6rem"}}>{form.contactName||"Unwritten Films"}</div>}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
                <div style={{fontWeight:700,fontSize:"1.6rem",color:"#fff",lineHeight:1}}>{form.project||"Production"}<br/><span style={{color:GOLD}}>Quote</span></div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontFamily:"monospace",fontSize:"0.62rem",color:GOLD}}>{form.quoteNum}</div>
                  <div style={{fontFamily:"monospace",fontSize:"0.52rem",color:"rgba(255,255,255,0.4)",marginTop:2}}>{new Date().toLocaleDateString("en-AU",{day:"numeric",month:"long",year:"numeric"})}</div>
                  <div style={{fontFamily:"monospace",fontSize:"0.52rem",color:"rgba(255,255,255,0.5)",marginTop:2}}>Valid {form.validDays} days</div>
                </div>
              </div>
            </div>
            <div style={{height:3,background:`linear-gradient(90deg,${GOLD} 0%,#e8b840 60%,transparent 100%)`}}/>
            <div style={{padding:"1rem"}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:1,background:"#d8d0c4",border:"1px solid #d8d0c4",marginBottom:"1rem"}}>
                {[["CLIENT",form.client],["PROJECT",form.project],["LOCATION",form.location],["SHOOT",form.shoot]].map(([l,v])=>(
                  <div key={l} style={{background:"#fff",padding:"0.6rem 0.8rem"}}>
                    <div style={{fontFamily:"monospace",fontSize:"0.48rem",letterSpacing:"0.1em",color:"#999",marginBottom:2}}>{l}</div>
                    <div style={{fontSize:"0.78rem",fontWeight:500}}>{v||"—"}</div>
                  </div>
                ))}
              </div>
              <div style={{fontWeight:700,fontSize:"0.9rem",borderBottom:`2px solid ${GOLD}`,paddingBottom:3,marginBottom:"0.75rem"}}>01 DELIVERABLES</div>
              <table style={{width:"100%",borderCollapse:"collapse",background:"#fff",border:"1px solid #d8d0c4",fontSize:"0.72rem",marginBottom:"1rem"}}>
                <thead><tr style={{background:"#1e1e1e"}}>
                  <th style={{padding:"0.45rem 0.6rem",textAlign:"left",fontFamily:"monospace",fontSize:"0.48rem",color:"#fff",fontWeight:400}}>ITEM</th>
                  <th style={{padding:"0.45rem 0.6rem",textAlign:"right",fontFamily:"monospace",fontSize:"0.48rem",color:"#fff",fontWeight:400}}>RATE</th>
                </tr></thead>
                <tbody>
                  {items.map((item,idx)=>{
                    const col=CAT_COLORS[item.category]||[136,136,136];
                    return(
                      <tr key={item.id} style={{borderBottom:"1px solid #ece6de",background:idx%2===0?"#fcfaf6":"#fff"}}>
                        <td style={{padding:"0.6rem"}}>
                          <div style={{fontWeight:500,fontSize:"0.76rem",marginBottom:2}}>
                            <span style={{background:`rgb(${col.join(",")})`,color:"#fff",fontFamily:"monospace",fontSize:"0.46rem",textTransform:"uppercase",padding:"0.1rem 0.28rem",borderRadius:2,marginRight:4}}>{item.category}</span>
                            {item.name}
                          </div>
                          {item.description&&<div style={{fontSize:"0.68rem",color:"#777",lineHeight:1.4}}>{item.description}</div>}
                        </td>
                        <td style={{padding:"0.6rem",textAlign:"right",fontFamily:"monospace",fontWeight:500,whiteSpace:"nowrap"}}>
                          {item.included?<span style={{color:GOLD,fontSize:"0.68rem"}}>Included</span>
                            :item.strikePrice?<><div style={{textDecoration:"line-through",color:"#bbb",fontSize:"0.68rem"}}>{fmtP0(item.price)}</div><div style={{color:GOLD,fontSize:"0.62rem"}}>Included</div></>
                            :item.price?fmtP0(item.price):"—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div style={{background:"#1e1e1e",color:"#fff",padding:"1rem",borderRadius:4,marginBottom:"1rem"}}>
                {items.filter(i=>!i.included&&!i.strikePrice&&i.price).map(i=>(
                  <div key={i.id} style={{display:"flex",justifyContent:"space-between",fontSize:"0.72rem",color:"rgba(255,255,255,0.5)",paddingBottom:"0.22rem"}}>
                    <span>{i.name}</span><span style={{fontFamily:"monospace"}}>{fmtP0(i.price)}</span>
                  </div>
                ))}
                {totals.disc>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:"0.72rem",color:GOLD,paddingBottom:"0.22rem"}}><span>{form.discLabel}</span><span style={{fontFamily:"monospace"}}>−{fmtP0(totals.disc)}</span></div>}
                <div style={{display:"flex",justifyContent:"space-between",borderTop:`2px solid ${GOLD}`,marginTop:"0.3rem",paddingTop:"0.45rem"}}>
                  <span style={{fontWeight:700,fontSize:"0.82rem"}}>Total (ex. GST)</span>
                  <span style={{fontWeight:700,fontSize:"1.3rem",color:"#e8b840",fontFamily:"monospace"}}>{fmtP0(totals.exGst)}</span>
                </div>
                {form.gst&&<>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:"0.7rem",color:"rgba(255,255,255,0.5)",paddingTop:"0.22rem"}}><span>GST (10%)</span><span style={{fontFamily:"monospace"}}>{fmtP0(totals.gstAmt)}</span></div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:"0.78rem",fontWeight:600,paddingTop:"0.18rem"}}><span>Total inc. GST</span><span style={{fontFamily:"monospace"}}>{fmtP0(totals.total)}</span></div>
                </>}
              </div>
              <div style={{fontWeight:700,fontSize:"0.9rem",borderBottom:`2px solid ${GOLD}`,paddingBottom:3,marginBottom:"0.75rem"}}>02 TERMS</div>
              {[[form.payment,"Payment"],[form.cancel,"Cancellation"],[form.usage,"Licensing & Usage"]].map(([txt,l])=>txt&&(
                <div key={l} style={{background:"#fff",border:"1px solid #d8d0c4",padding:"0.7rem",marginBottom:"0.45rem",borderRadius:4}}>
                  <div style={{fontFamily:"monospace",fontSize:"0.5rem",letterSpacing:"0.1em",color:"#999",marginBottom:3,textTransform:"uppercase"}}>{l}</div>
                  <div style={{fontSize:"0.72rem",color:"#444",lineHeight:1.5}}>{txt}</div>
                </div>
              ))}
              <div style={{background:"#1e1e1e",padding:"1rem",display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:"0.5rem",borderRadius:4}}>
                <div>
                  <div style={{fontWeight:700,fontSize:"0.95rem",color:"#fff"}}>{form.contactName||"Unwritten Films"}</div>
                  <div style={{fontFamily:"monospace",fontSize:"0.5rem",color:GOLD,marginBottom:3}}>Videographer & Photographer · Mackay, QLD</div>
                  <div style={{fontSize:"0.68rem",color:"rgba(255,255,255,0.5)"}}>{[form.phone,form.email].filter(Boolean).join(" · ")}</div>
                </div>
                <div style={{fontFamily:"monospace",fontSize:"0.5rem",color:"rgba(255,255,255,0.3)",textAlign:"right"}}>Valid {form.validDays} days<br/>from date of issue</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

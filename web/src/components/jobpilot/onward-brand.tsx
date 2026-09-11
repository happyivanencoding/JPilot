"use client";
export function OnwardBrand({large=false}:{large?:boolean}) {
 return <span className={`onward-brand${large?' large':''}`} aria-label="Onward">
  <img className="onward-icon" src="/onward-icon.svg" alt="" width={large?46:36} height={large?46:36}/>
  <span className="onward-word" aria-hidden="true">Onward</span>
 </span>;
}

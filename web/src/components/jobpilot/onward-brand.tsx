"use client";
export function OnwardBrand({large=false}:{large?:boolean}) {
 return <span className={`onward-brand${large?' large':''}`} aria-label="Onward">
  <img className="onward-lockup" src="/onward-lockup.svg" alt="" width={large?174:142} height={large?30:25}/>
 </span>;
}

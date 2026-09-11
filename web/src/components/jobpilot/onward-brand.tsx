"use client";
export function OnwardBrand({large=false}:{large?:boolean}) {
 return <span className={`onward-brand${large?' large':''}`} aria-label="Onward">
  <img className="onward-icon" src="/onward-icon.svg" alt="" width={large?46:36} height={large?46:36}/>
  <img className="onward-wordmark light" src="/onward-wordmark.svg" alt="Onward" width={large?143:122} height={large?43:37}/>
  <img className="onward-wordmark dark" src="/onward-wordmark-light.svg" alt="" aria-hidden="true" width={large?143:122} height={large?43:37}/>
 </span>;
}

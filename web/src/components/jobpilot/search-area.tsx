"use client";
import {useState} from 'react';
import {usePilot,type Json} from './pilot-context';
import {Button,Card,Chip,Input} from './ui';

export function SearchAreaFields({value,onChange}:{value:Json;onChange:(v:Json)=>void}) {
 const {tr}=usePilot();
 return <div className="jp-stack" data-testid="search-area">
  <strong>{tr('你想在哪儿工作？','Où souhaitez-vous travailler ?','Where would you like to work?')}</strong>
  <div className="jp-chips"><Chip selected={value.scope==='city'} onClick={()=>onChange({...value,scope:'city'})}>{tr('选择城市','Une ville','Choose a city')}</Chip><Chip selected={value.scope==='france'} onClick={()=>onChange({...value,scope:'france'})}>{tr('全法国','Toute la France','All of France')}</Chip></div>
  {value.scope==='city'&&<><Input label={tr('城市','Ville','City')} data-testid="search-city" value={value.city||''} placeholder="Paris" maxLength={80} list="onward-cities" onChange={e=>onChange({...value,city:e.target.value})}/><datalist id="onward-cities">{['Paris','Lyon','Marseille','Toulouse','Bordeaux','Lille','Nantes','Strasbourg','Nice','Rennes','Montpellier','Grenoble'].map(city=><option key={city} value={city}/>)}</datalist></>}
 </div>;
}
export function SearchAreaSettings({embedded=false}:{embedded?:boolean}={}) {
 const p=usePilot(),{tr}=p;
 const stored=p.data.config?.target_roles?.search_area;
 const [value,setValue]=useState<Json>(stored||{scope:'city',city:'Paris'});
 const content=<><SearchAreaFields value={value} onChange={setValue}/><div className="onward-search-area-submit"><Button className="onward-search-area-submit-button" disabled={p.busy||value.scope==='city'&&!String(value.city||'').trim()} onClick={()=>p.act({searchArea:value},'/api/profile')}>{tr('应用范围','Appliquer','Apply')}</Button></div></>;
 return embedded?<div className="jp-stack onward-search-area-settings">{content}</div>:<Card>{content}</Card>;
}

package com.thegreatnovel.jobpilot

/** Approximate depth by visible item fraction; a tall first item is not 100% read. */
fun analyticsScrollPercent(total:Int,lastIndex:Int,lastOffset:Int,lastSize:Int,viewportEnd:Int):Int {
    if(total<=0 || lastSize<=0)return 0
    val fraction=((viewportEnd-lastOffset).toDouble()/lastSize).coerceIn(0.0,1.0)
    return (((lastIndex+fraction)/total)*100).toInt().coerceIn(0,100)
}

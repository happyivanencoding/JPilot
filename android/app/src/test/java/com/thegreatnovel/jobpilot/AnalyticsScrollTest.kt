package com.thegreatnovel.jobpilot
import org.junit.Assert.assertEquals
import org.junit.Test
class AnalyticsScrollTest {
    @Test fun tallSingleItemDoesNotReportBottomAtTop() {assertEquals(25,analyticsScrollPercent(1,0,0,2000,500))}
    @Test fun lastItemAtBottomReportsComplete() {assertEquals(100,analyticsScrollPercent(5,4,250,250,500))}
    @Test fun emptyListHasNoDepth() {assertEquals(0,analyticsScrollPercent(0,0,0,0,500))}
}

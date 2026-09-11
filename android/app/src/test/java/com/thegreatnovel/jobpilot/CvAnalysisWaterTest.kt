package com.thegreatnovel.jobpilot

import org.junit.Assert.*
import org.junit.Test

class CvAnalysisWaterTest {
    @Test fun progressSlowsNearCompletion() {
        assertTrue(cvWaterFraction(35.0, false) in .8f.. .9f)
        assertTrue(cvWaterFraction(55.0, false) in .9f.. .96f)
        val early = cvWaterFraction(20.0, false) - cvWaterFraction(10.0, false)
        val late = cvWaterFraction(60.0, false) - cvWaterFraction(50.0, false)
        assertTrue(early > late)
    }
    @Test fun onlyServerCompletionFillsTheScreen() {
        assertEquals(.96f, cvWaterFraction(10000.0, false), .0001f)
        assertEquals(1f, cvWaterFraction(1.0, true), .0001f)
        assertEquals(.04f, cvWaterFraction(-1.0, false), .0001f)
    }
}

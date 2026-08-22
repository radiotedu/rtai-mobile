package com.radiotedumobile.car

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CarCatalogPolicyTest {

    @Test
    fun cachedRootAcceptsOnlyLiveAndPodcasts() {
        assertTrue(CarCatalogPolicy.isAllowedCategory("cat_radio", "", false))
        assertTrue(CarCatalogPolicy.isAllowedCategory("cat_podcasts", "", false))
        assertFalse(CarCatalogPolicy.isAllowedCategory("cat_rankings", "", false))
        assertFalse(CarCatalogPolicy.isAllowedCategory("cat_jukebox", "", false))
        assertFalse(CarCatalogPolicy.isAllowedCategory("cat_radio", "legacy", true))
    }

    @Test
    fun onlyPodcastSeriesCanNestBelowPodcasts() {
        assertTrue(
            CarCatalogPolicy.isAllowedCategory(
                "podcast-series:news",
                "cat_podcasts",
                true,
            ),
        )
        assertFalse(
            CarCatalogPolicy.isAllowedCategory(
                "podcast-series:news",
                "cat_rankings",
                true,
            ),
        )
    }

    @Test
    fun staleCategoryItemsCannotLeakIntoBrowseOrSearch() {
        assertTrue(CarCatalogPolicy.isAllowedItem("cat_radio", "radio", "", true))
        assertTrue(
            CarCatalogPolicy.isAllowedItem(
                "cat_podcasts",
                "episode",
                "podcast-series:news",
                true,
            ),
        )
        assertFalse(CarCatalogPolicy.isAllowedItem("cat_rankings", "rank", "", true))
        assertFalse(CarCatalogPolicy.isAllowedItem("cat_jukebox", "song", "", true))
        assertFalse(CarCatalogPolicy.isAllowedItem("cat_podcasts", "radio", "", true))
        assertFalse(
            CarCatalogPolicy.isAllowedItem(
                "podcast-series:news",
                "episode",
                "podcast-series:other",
                true,
            ),
        )
    }
}

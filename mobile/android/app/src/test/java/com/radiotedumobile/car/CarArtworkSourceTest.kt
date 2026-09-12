package com.radiotedumobile.car

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class CarArtworkSourceTest {
    @Test fun resolvesOnlyTheExactRegisteredHttpsImage() {
        val registered = "https://example.org/podcast/cover.jpg"
        val other = "https://example.org/private/other.jpg"
        assertEquals(registered, catalogArtworkSource(artworkName(registered), listOf(registered)))
        assertNull(catalogArtworkSource(artworkName(other), listOf(registered)))
        assertNull(catalogArtworkSource(artworkName(registered), emptyList()))
    }

    @Test fun rejectsPathTraversalAndNonHttpsCatalogEntries() {
        val insecure = "http://example.org/cover.jpg"
        assertNull(catalogArtworkSource("../cover.jpg", listOf(insecure)))
        assertNull(catalogArtworkSource(artworkName(insecure), listOf(insecure)))
        val local = "file:///data/user/0/com.radiotedumobile/private"
        assertNull(catalogArtworkSource(artworkName(local), listOf(local)))
    }
}

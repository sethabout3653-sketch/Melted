# Melted Cinema: personal Jellyfin playback

The Movies tab uses TMDB for discovery metadata and your own Jellyfin server as the only playback source. It does not scrape, proxy, or discover streams from third-party embed sites.

## Connect your Jellyfin library

1. In Jellyfin, add the movies or shows you are authorized to stream and allow the library scan to finish.
2. In the Jellyfin dashboard, create an API key under **API Keys**.
3. Open Melted's Movies tab, open settings, and enter the Jellyfin base URL and API key. Use HTTPS for remote access; use HTTP only on a trusted local network.
4. Configure Jellyfin's network/CORS allowed origins to permit the Melted site's origin. The browser connects directly to Jellyfin.
5. Ensure your library's TMDB provider IDs are available in Jellyfin metadata. Melted matches a discovered TMDB title against those IDs before playback.

The API key is kept in the current browser tab's `sessionStorage` and is not sent to Melted's backend. Disconnect or close the tab to clear it. A Jellyfin stream token is included in the playback URL because browser video elements cannot attach custom authorization headers; treat the session and device as sensitive while connected.

Playback uses Jellyfin's direct stream endpoint. If a browser cannot play an item's format, enable a compatible Jellyfin transcoding profile/server-side transcoding or use a Jellyfin client. This feature only plays items in the configured personal library.

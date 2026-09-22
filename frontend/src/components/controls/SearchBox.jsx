/**
 * SearchBox - Place search with Nominatim
 */

import { useState, useCallback, useRef } from "react";
import { MapPin, Search, X } from "lucide-react";
import { geocodingAPI } from "../../api/client.js";

export function SearchBox({ onSelectDestination, disabled }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState(null);
  const debounceRef = useRef(null);

  const handleSearch = useCallback((e) => {
    e.preventDefault();
    if (!query.trim() || disabled) return;

    setError(null);
    setIsSearching(true);
    setResults([]);

    geocodingAPI.search(query)
      .then((data) => {
        setResults(data);
        if (data.length === 0) {
          setError("No locations found");
        }
      })
      .catch((err) => {
        setError("Unable to search right now");
      })
      .finally(() => {
        setIsSearching(false);
      });
  }, [query, disabled]);

  const handleChange = useCallback((e) => {
    const value = e.target.value;
    setQuery(value);

    // Clear results if query is cleared
    if (!value.trim()) {
      setResults([]);
      setError(null);
    }
  }, []);

  const selectPlace = useCallback((place) => {
    const destination = {
      lat: Number(place.lat),
      lng: Number(place.lon),
      label: place.display_name
    };
    onSelectDestination(destination);
    setResults([]);
    setQuery("");
  }, [onSelectDestination]);

  const clearSearch = useCallback(() => {
    setQuery("");
    setResults([]);
    setError(null);
  }, []);

  return (
    <div className="search-container">
      <form className="search-row" onSubmit={handleSearch}>
        <input
          type="text"
          value={query}
          onChange={handleChange}
          placeholder="Search destination"
          aria-label="Search destination"
          disabled={disabled || isSearching}
        />
        {query && (
          <button type="button" onClick={clearSearch} className="search-clear" aria-label="Clear search">
            <X size={16} />
          </button>
        )}
        <button type="submit" disabled={disabled || isSearching} aria-label="Search">
          {isSearching ? <span className="spinner" /> : <Search size={18} />}
        </button>
      </form>

      {error && <div className="search-error">{error}</div>}

      {results.length > 0 && (
        <div className="result-list" role="listbox">
          {results.map((place) => (
            <button
              key={place.place_id}
              type="button"
              onClick={() => selectPlace(place)}
              role="option"
            >
              <MapPin size={16} />
              <span>{place.display_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

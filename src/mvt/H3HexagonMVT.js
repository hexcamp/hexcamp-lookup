import React, { useState, useEffect, useReducer, useMemo } from "react";
import { FlyToInterpolator } from "@deck.gl/core";
import { geoToH3 } from "h3-js";
import produce from "immer";
import { useLocation } from "react-router-dom";
import hexToUrl from "./hex-to-url";
import urlToHex from "./url-to-hex";
import locations from "./locations";
import H3HexagonView from "./h3-hexagon-view";
import ResolutionSelect from "./resolution-select";
import LocationPicker from "./location-picker";
import getPeerIdFromH3HexAndSecret from "./deterministic-peer-id";
import WebRTCPanel from "./webrtc-panel";
import listenersReducer from "./listeners-reducer";

// var array = new Uint8Array(64); crypto.getRandomValues(array)
// Array.from(array).map(b => b.toString(16).padStart(2, "0")).join('')
const secretHex =
  "105471fbca3674e6b45709a56381891e133618ada169e52496907d461be55760" +
  "02998949f060111889810320f8ff4f57b58734c187896ecf4daa44baeba9553f";

export default function H3HexagonMVT({ homeLinkCounter }) {
  const [resolution, setResolution] = useState(5);
  const [dataSolid, setDataSolid] = useState([]);
  const [dataIndex, setDataIndex] = useState(new Map());
  const [nextColor, setNextColor] = useState(0);
  const location = useLocation();
  const [initialViewState, setInitialViewState] = useState({
    ...locations.world,
    maxZoom: 20,
    minZoom: 1,
  });
  const [viewState, setViewState] = useState({});
  const [selectedHex, setSelectedHex] = useState();
  const [queryHex, setQueryHex] = useState();

  const selectedHexBase32 = useMemo(
    () => (selectedHex ? hexToUrl(selectedHex[1]) : ""),
    [selectedHex]
  );
  const [peerId, setPeerId] = useState();
  useEffect(() => {
    setPeerId(null);
    if (selectedHex) {
      async function run() {
        const peerId = await getPeerIdFromH3HexAndSecret(
          selectedHex[1],
          secretHex
        );
        setPeerId(peerId);
      }
      run();
    }
  }, [selectedHex]);

  useEffect(() => {
    const key = location.search.replace("?loc=", "");
    if (locations[key]) {
      const initialViewState = {
        ...locations[key],
        transitionInterpolator: new FlyToInterpolator({
          speed: 1.5,
        }),
        transitionDuration: "auto",
        maxZoom: 20,
        minZoom: 1,
      };
      setInitialViewState(initialViewState);
    }
  }, [location]);

  useEffect(() => {
    const initialViewState = {
      ...locations.world,
      transitionInterpolator: new FlyToInterpolator({
        speed: 1.5,
      }),
      transitionDuration: "auto",
      maxZoom: 20,
      minZoom: 1,
    };
    setInitialViewState(initialViewState);
  }, [homeLinkCounter]);

  const [listeners, dispatchListenersAction] = useReducer(listenersReducer, {});
  useEffect(() => {
    async function fetchData() {
      const response = await fetch(process.env.PUBLIC_URL + "/data.json");
      const data = await response.json();
      setDataSolid(data.solid);
      setViewState(data.viewState);
      updateDataIndex(data.solid);
    }
    fetchData();
  }, [setDataSolid, setViewState]);

  function updateDataIndex(data) {
    const dataIndex = new Map();
    for (const d of data) {
      dataIndex.set(d.hex, d);
    }
    setDataIndex(dataIndex);
  }

  function pushLatLng(lat, lng) {
    const hex = geoToH3(lat, lng, resolution);
    const colorIndex = nextColor % 10;
    const newDataPoint = {
      hex,
      // count: 30 * (9.682 - Math.log((resolution + 1) * 1000)),
      count:
        1000 * (1 / Math.log((resolution + 2) * (resolution + 2)) / 10) - 17.5,
      colorIndex,
      type: "No type",
      label: "Unlabeled",
    };
    setNextColor(colorIndex + 1);
    const nextData = produce(dataSolid, (draft) => {
      draft.push(newDataPoint);
    });
    setDataSolid(nextData);
    updateDataIndex(nextData);
  }

  function pickHex(layer, hex) {
    setSelectedHex([layer, hex]);
  }

  function removeHex(layer, hexToRemove) {
    const nextData = produce(dataSolid, (draft) => {
      draft.splice(
        0,
        draft.length,
        ...draft.filter(({ hex }) => hex !== hexToRemove)
      );
    });
    setDataSolid(nextData);
    updateDataIndex(nextData);
  }

  function addHex(hex) {
    const colorIndex = nextColor % 10;
    const newDataPoint = {
      hex,
      // count: 30 * (9.682 - Math.log((resolution + 1) * 1000)),
      count:
        1000 * (1 / Math.log((resolution + 2) * (resolution + 2)) / 10) - 17.5,
      colorIndex,
      type: "No type",
      label: "Unlabeled",
    };
    setNextColor(colorIndex + 1);
    const nextData = produce(dataSolid, (draft) => {
      draft.length = 0;
      draft.push(newDataPoint);
    });
    setDataSolid(nextData);
    updateDataIndex(nextData);
  }

  return (
    <div>
      <div>
        <input
          type="text"
          onInput={(evt) => setQueryHex(evt.target.value)}
        ></input>
        <button
          onClick={(evt) => {
            console.log("Jim", queryHex);
            const hex = urlToHex(queryHex);
            addHex(hex);
            pickHex('solid', hex);
          }}
        >
          Find Hex
        </button>
        (eg. 2kgrugszem7q, uxirkffr)
      </div>
      <div style={{ display: "flex" }}>
        <ResolutionSelect
          resolution={resolution}
          setResolution={setResolution}
        />
        <LocationPicker flatten={flatten} />
      </div>
      <div style={{ display: "flex" }}>
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "70vh",
            background: "#64828c",
          }}
        >
          <H3HexagonView
            dataSolid={dataSolid}
            initialViewState={initialViewState}
            setInitialViewState={setInitialViewState}
            pushLatLng={pushLatLng}
            pickHex={pickHex}
            setViewState={setViewState}
            selectedHex={selectedHex}
            setSelectedHex={setSelectedHex}
          />
        </div>
        <div style={{ width: "100%" }}>
          <h3>Selected</h3>
          {selectedHex && (
            <>
              <div>Type: {dataIndex.get(selectedHex[1]).type}</div>
              <div>Label: {dataIndex.get(selectedHex[1]).label}</div>
              <div>
                Hex: {selectedHex[1]} {selectedHex[0]}
              </div>
              <div>Base32: {selectedHexBase32}</div>
              <div>
                Hex.Camp URL:{" "}
                <a href={`https://${selectedHexBase32}.hex.camp`}>
                  {selectedHexBase32}.hex.camp
                </a>
              </div>
              <div style={{ fontSize: "small" }}>
                PeerID: {peerId && peerId.toB58String()}
              </div>
              <div>
                <button
                  onClick={() => {
                    removeHex(selectedHex[0], selectedHex[1]);
                    setSelectedHex(null);
                  }}
                >
                  Delete
                </button>
                <button onClick={() => setSelectedHex(null)}>Deselect</button>
              </div>
              {peerId && (
                <WebRTCPanel
                  peerId={peerId}
                  listeners={listeners}
                  dispatchListenersAction={dispatchListenersAction}
                />
              )}
            </>
          )}
          <h3>Data</h3>
          <details>
            <pre>
              {JSON.stringify(
                {
                  viewState,
                  solid: dataSolid,
                },
                null,
                2
              )}
            </pre>
          </details>
        </div>
      </div>
      {location.pathname === "/" && (
        <div style={{ padding: "0.5rem" }}>
          {selectedHex ? (
            <>
              {dataIndex.get(selectedHex[1]).type}:
              <a href={`https://${selectedHexBase32}.hex.camp`}>
                {dataIndex.get(selectedHex[1]).label}
              </a>
            </>
          ) : (
            <span>No hexagon selected.</span>
          )}
        </div>
      )}
    </div>
  );

  function flatten(event) {
    const initialViewState = {
      ...viewState,
      pitch: 0,
      bearing: 0,
      transitionInterpolator: new FlyToInterpolator(),
      transitionDuration: 1000,
    };
    setInitialViewState(initialViewState);
    event.preventDefault();
  }
}

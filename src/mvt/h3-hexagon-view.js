import React, { Component, useEffect } from 'react'
import {
  AmbientLight,
  PointLight,
  LightingEffect,
  MapView
} from '@deck.gl/core'
import { schemeCategory10 } from 'd3-scale-chromatic'
import { color as d3Color } from 'd3-color'
import throttle from 'lodash.throttle'
import { IconLayer } from '@deck.gl/layers'
import { H3HexagonLayer, MVTLayer } from '@deck.gl/geo-layers'
import { cellToLatLng, cellToBoundary } from 'h3-js'
import produce from 'immer'
import DeckGL from '@deck.gl/react'
import { FlyToInterpolator } from '@deck.gl/core'
import hexToUrl from './hex-to-url'
import tokens from '../tokens.json'
import IconClusterLayer from './icon-cluster-layer'

// Set your mapbox token here
// const MAPBOX_TOKEN = localStorage.getItem('mapbox_token')
const MAPBOX_TOKEN = tokens.mapbox
const iconMapping = process.env.PUBLIC_URL + '/location-icon-mapping.json'
const iconAtlas = process.env.PUBLIC_URL + '/location-icon-atlas.png'

const ambientLight = new AmbientLight({
  color: [255, 255, 255],
  intensity: 1.0
})

const pointLight1 = new PointLight({
  color: [255, 255, 255],
  intensity: 0.8,
  position: [-0.144528, 49.739968, 80000]
})

const pointLight2 = new PointLight({
  color: [255, 255, 255],
  intensity: 0.8,
  position: [-3.807751, 54.104682, 8000]
})

const lightingEffect = new LightingEffect({
  ambientLight,
  pointLight1,
  pointLight2
})

const material = {
  ambient: 0.64,
  diffuse: 0.6,
  shininess: 32,
  specularColor: [51, 51, 51]
}

const colorRange = [
  [1, 152, 189],
  [73, 227, 206],
  [216, 254, 181],
  [254, 237, 177],
  [254, 173, 84],
  [209, 55, 78]
]

const colors = schemeCategory10.map(colorName => {
  const { r, g, b } = d3Color(colorName).brighter()
  return [r, g, b]
})

const elevationScale = { min: 1, max: 50 }

function UpdateViewState ({ updateViewState, viewState }) {
  useEffect(() => {
    updateViewState(viewState)
  }, [updateViewState, viewState])
  return null
}

export default class H3HexagonView extends Component {
  static get defaultColorRange () {
    return colorRange
  }

  constructor (props) {
    super(props)
    this.updateViewState = throttle(this._updateViewState.bind(this), 1000)
    this.tooltipRef = React.createRef()
    this.state = {
      elevationScale: elevationScale.min,
      viewState: {}
    }
  }

  _setTooltip (message, x, y) {
    const el = this.tooltipRef.current
    if (message) {
      el.innerHTML = message
      el.style.display = 'block'
      el.style.left = x + 10 + 'px'
      el.style.top = y + 10 + 'px'
      el.style.color = '#fff'
    } else {
      el.style.display = 'none'
    }
  }

  _renderLayers () {
    const { dataSolid, pickHex, selectedHex } = this.props
    const {
      viewState: { zoom }
    } = this.state

    const iconClusterLayer = new IconClusterLayer({
      id: 'icon-cluster',
      data: dataSolid,
      getPosition: d => {
        const latLng = cellToLatLng(d.hex)
        return [latLng[1], latLng[0]]
      },
      sizeScale: 40,
      pickable: true,
      iconAtlas,
      iconMapping,
      // onHover: !hoverInfo.objects && setHoverInfo
      onClick: info => {
        let hexes = []
        if (info?.object?.hex) {
          hexes.push(info.object.hex)
          setTimeout(() => {
            this.props.pickHex('solid', info.object.hex)
          }, 1000)
        }
        if (info?.objects) {
          for (const object of info.objects) {
            hexes.push(object.hex)
          }
        }
        if (hexes.length > 0) {
          let points = []
          for (const hex of hexes) {
            const hexBoundary = cellToBoundary(hex)
            points = points.concat(hexBoundary)
          }

          const [minLat, maxLat, minLng, maxLng] = points.reduce(
            ([oldMinLat, oldMaxLat, oldMinLng, oldMaxLng], [lat, lng]) => {
              const minLat = oldMinLat === null ? lat : Math.min(oldMinLat, lat)
              const maxLat = oldMaxLat === null ? lat : Math.max(oldMaxLat, lat)
              const minLng = oldMinLng === null ? lng : Math.min(oldMinLng, lng)
              const maxLng = oldMaxLng === null ? lng : Math.max(oldMaxLng, lng)
              return [minLat, maxLat, minLng, maxLng]
            },
            [null, null, null, null]
          )
          const bounds = [
            [minLng, minLat],
            [maxLng, maxLat]
          ]
          const newViewport = info.viewport.fitBounds(bounds, { padding: 100 })

          const initialViewState = {
            latitude: newViewport.latitude,
            longitude: newViewport.longitude,
            zoom: newViewport.zoom,
            pitch: 0,
            bearing: 0,
            transitionInterpolator: new FlyToInterpolator(),
            transitionDuration: 1000
          }
          this.props.setInitialViewState(initialViewState)
        }
        return true
      }
    })

    const mvtLayer = new MVTLayer({
      data: `https://a.tiles.mapbox.com/v4/mapbox.mapbox-streets-v7/{z}/{x}/{y}.vector.pbf?access_token=${MAPBOX_TOKEN}`,
      // data: `http://localhost:5000/satellite-lowres/{z}/{x}/{y}.pbf`,
      // data: `http://localhost:5000/canary/{z}/{x}/{y}.pbf`,
      // data: `http://tile.stamen.com/toner/{z}/{x}/{y}.png`,
      // data: `http://localhost:5000/world_countries/{z}/{x}/{y}.pbf`,
      // data: `http://localhost:5000/states_provinces/{z}/{x}/{y}.pbf`,
      // data: `http://localhost:7000/ne_10m_admin_1_states_provinces.mbtiles/{z}/{x}/{y}.pbf`,
      // data: `http://localhost:5000/states_provinces_unzipped/{z}/{x}/{y}.pbf`,
      // data: `https://ipfs.io/ipfs/bafybeigyfjxrsxrlt2emeyvm3gihb7wvkbcqiel7xfa37yf4o4me6phua4/states_provinces/{z}/{x}/{y}.pbf`,
      // data: `https://ipfs.io/ipfs/QmUefFZttPf9xq4KTkk94rBbZEVrBsTreDi4JA8KYhQFX6/{z}/{x}/{y}`, // IPFS Demo

      minZoom: 0,
      maxZoom: 23, // MapBox
      // maxZoom: 5, // states_provinces
      // maxZoom: 9, // IPFS Demo
      getLineColor: [192, 192, 192],
      // getFillColor: [100, 130, 140],
      getFillColor: [40, 40, 40],
      getLineWidth: 1,
      lineWidthMinPixels: 1
    })

    const hexLayer = new H3HexagonLayer({
      id: 'h3-hexagon-layer-solid',
      data: dataSolid,
      pickable: true,
      autoHighlight: true,
      highlightColor: [255, 255, 255, 100],
      wireframe: false,
      filled: true,
      extruded: false,
      material,
      elevationScale: zoom ? 5.0 + 30.0 * (10.0 / zoom) : 5,
      getHexagon: d => d.hex,
      // getFillColor: d => {
      getLineWidth: 3,
      getFillColor: d => {
        if (
          selectedHex &&
          selectedHex[0] === 'solid' &&
          d.hex === selectedHex[1]
        ) {
          return [255, 255, 255]
        } else {
          const color = colors[d.colorIndex]
          return [color[0], color[1], color[2], 100]
        }
      },
      getLineColor: d => {
        if (
          selectedHex &&
          selectedHex[0] === 'solid' &&
          d.hex === selectedHex[1]
        ) {
          return [255, 255, 255]
        } else {
          return colors[d.colorIndex]
        }
      },
      lineWidthMinPixels: 1,
      getElevation: d => {
        if (
          selectedHex &&
          selectedHex[0] === 'solid' &&
          d.hex === selectedHex[1]
        ) {
          return d.count * 1.5
        } else {
          return d.count
        }
      },
      updateTriggers: {
        getFillColor: [selectedHex],
        getElevation: [selectedHex]
      },
      onHover: info => {
        this._setTooltip(
          info.object && info.object.hex ? hexToUrl(info.object.hex) : '',
          info.x,
          info.y
        )
      },
      onClick: info => {
        if (info && info.object) {
          pickHex('solid', info.object.hex)
          return true
        }
      }
    })

    // return [mvtLayer, hexLayer, iconLayer]
    return [mvtLayer, hexLayer, iconClusterLayer]
  }

  _updateViewState (viewState) {
    const nextViewState = produce(this.state.viewState, draft => {
      for (const key in viewState) {
        draft[key] = viewState[key]
      }
    })
    if (nextViewState !== this.state.viewState) {
      this.setState({ viewState: nextViewState })
      this.props.setViewState(nextViewState)
    }
  }

  render () {
    return (
      <>
        <div
          ref={this.tooltipRef}
          style={{
            position: 'absolute',
            zIndex: 1,
            pointerEvents: 'none'
          }}
        />
        <DeckGL
          layers={this._renderLayers()}
          effects={[lightingEffect]}
          initialViewState={this.props.initialViewState}
          controller={true}
          onClick={this.onClick.bind(this)}
          views={new MapView({ repeat: true })}
          onViewStateChange={() => {
            this._setTooltip()
            setTimeout(() => this.props.setSelectedHex(), 0)
          }}
          getCursor={({ isHovering }) => (isHovering ? 'pointer' : 'grab')}
        >
          {({ viewState }) => (
            <UpdateViewState
              updateViewState={this.updateViewState}
              viewState={viewState}
            />
          )}
        </DeckGL>
      </>
    )
  }

  onClick (info) {
    const {
      coordinate: [lng, lat]
    } = info
    this.props.pushLatLng(lat, lng)
  }
}

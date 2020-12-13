import React, {Fragment} from "react"
import Interpreter from "../interpreter"
import Anchor from "./anchor/anchor"
import ScrollDetect from "./scroll/scroll"
import Tag from "./tag/tag"
import Tokenize from "./tokenize"

const Parse = (props) => {
  const tokens = []
  Tokenize(tokens, props.gameState, props.stackFrame, props.target)

  const toDisplay = []
  const append = (Component) => {
    toDisplay.push(<Fragment key={toDisplay.length + 1}>{Component}</Fragment>)
  }

  let betweenText = []
  let layerContents = []

  tokens.forEach(token => {
    switch (token.type) {
      case ";": // comment
        // console.log(token.text) // ignore comments in general
        break
      case "t": // text
        layerContents = RenderChunk(betweenText, layerContents, append)
        betweenText = []
        append(<span>{token.text}</span>)
        break
      case "*": // link
        betweenText.push(token)
        break
      case "@": // full-line tag
      case "[": // inline tag
        if (token.command.toLowerCase() === "align") {
          layerContents = RenderChunk(betweenText, layerContents, append)
          betweenText = []
          append(<div style={{textAlign: "center"}}>{token.args.text}</div>)
        } else {
          betweenText.push(token)
        }
        break
      case "EOF":
        layerContents = RenderChunk(betweenText, layerContents, append)
        betweenText = []
        // append(<div>--- end of {token.storage} ---</div>)
        break
      case "call": // jump or call statements require more page loading
        layerContents = RenderChunk(betweenText, layerContents, append)
        betweenText = []
        append(<Interpreter gameState={token.gameState}
                            storage={token.storage}
                            target={token.target}
                            returnFrame={token.returnFrame}/>)
        break
      default:
        console.log("warning: unhandled token type: " + token.type, token)
    }
  })
  return toDisplay
}

const debug = false
let uuid = 1

const RenderChunk = (tokens, layerContents, append) => {
  let isDivider = false
  let backgroundFolder = null
  let background = null

  let time = 0
  let endTime = 0

  let layers = layerContents
  let transition = []
  let animation = []

  const lastFrame = (layer) => {
    layer = layer === "base" ? 0 : (layer || 0)
    const animation = layers[layer] || []
    return animation[animation.length - 1]
  }
  // retrieve the layer contents generated by the last animation
  const lastContents = (layer) => {
    layer = layer === "base" ? 0 : (layer || 0)
    return (lastFrame(layer) || {}).contents || {folder: "bgimage/", image: "black"}
  }

  const pushFrame = (layer, frame) => {
    isDivider = true
    layer = layer === "base" ? 0 : (layer || 0)
    layers[layer] = layers[layer] || []
    layers[layer].push(frame)
  }

  const duplicateLastFrame = (layer, overrides) => {
    layer = layer === "base" ? 0 : (layer || 0)
    let frame = lastFrame(layer) || {contents: {folder: "bgimage/", image: "black"}, top: 0, left: 0}
    frame = Object.assign({}, frame, {time: time}, overrides || {})
    pushFrame(layer, frame)
  }

  const clearOtherLayers = layer => {
    layer = layer === "base" ? 0 : (layer || 0)
    // there must be a cleaner way to indicate that a layer has been removed
    layers.forEach(animation => {
      if (animation !== layers[layer]) {
        if (lastContents(layer).image) {
          animation.push({
            contents: {},
            time: time,
          })
        }
      }
    })
  }

  const pushBasicFrame = (token, folder, image, timeOffset, fadeInsteadOfAnimate) => {
    pushFrame(token.args.layer, {
      time: time + (timeOffset ? parseInt(timeOffset, 10) : 0),
      contents: {
        image: image,
        folder: folder,
        key: fadeInsteadOfAnimate === !lastContents(token.args.layer).key,
        transform: [token.args.fliplr ? "scaleX(-1)" : "", token.args.flipud ? "scaleY(-1)" : ""].join(" ") || undefined,
      },
      left: token.args.left ? parseInt(token.args.left, 10) : 0,
      top: token.args.top ? parseInt(token.args.top, 10) : 0,
      opacity: (token.args.opacity ? parseInt(token.args.opacity, 10) : 255) / 255,
    })
  }

  tokens.forEach(token => {
    switch (token.type) {
      case ";": // comment
        // console.log(token.text) // ignore comments in general
        break
      case "*": // link
        append(<Anchor name={token.link}/>)
        break
      case "@": // full-line tag
      case "[": // inline tag
        if (debug) {
          append(<Tag command={token}/>)
        }
        switch (token.command.toLowerCase()) {
          case "dashcombo": // these use opacity values where 0 is fully visible
          case "dashcombot": // imag = initial_mag?, mag = scale, fliplr, cx, cy,
            if (token.args.layer && token.args.layer.startsWith("&")) {
              break
            }

            let cx = token.args.cx === "c" ? "400" : token.args.cx || "0"
            let cy = token.args.cy === "c" ? "300" : token.args.cy || "0"

            let fOrigT = "translate(" + (cx ? parseInt(cx, 10) / 8 - 50 + "%" : "50%") + "," + (cy ? parseInt(cy, 10) / 6 - 50 + "%" : "50%") + ")"
            let rOrigT = "translate(" + (cx ? -parseInt(cx, 10) / 8 + 50 + "%" : "50%") + "," + (cy ? -parseInt(cy, 10) / 6 + 50 + "%" : "50%") + ")"

            pushFrame(token.args.layer, {
              time: time,
              contents: {
                image: token.args.storage,
                folder: "bgimage/",
                key: !lastContents(token.args.layer).key,
                transform: [token.args.fliplr ? "scaleX(-1)" : "", token.args.flipud ? "scaleY(-1)" : ""].join(" ") || undefined,
              },
              transform: fOrigT + " scale(" + (token.args.imag ? token.args.imag : 1) + ") " + rOrigT,
              acceleration: token.args.accel || 0,
              left: 0,
              top: 0,
              opacity: 1, // (token.args.opacity ? (255 - parseInt(token.args.opacity, 10)) : 0) / 255,
            })

            time += parseInt(token.args.time, 10) || 0
            duplicateLastFrame(token.args.layer, {
              transform: fOrigT + " scale(" + (token.args.mag ? token.args.mag : 2) + ") " + rOrigT,
            })

            append(<Tag command={token} color="red"/>)
            break
          case "imageex":
          case "image":
          case "image4demo":
            if (token.args.layer && token.args.layer.startsWith("&")) {
              break
            }
            pushBasicFrame(token, "bgimage/", token.args.storage, 0, true)
            // pushFrame(token.args.layer, {
            //   time: time,
            //   contents: {
            //     image: token.args.storage,
            //     folder: "bgimage/",
            //     key: !lastContents(token.args.layer).key,
            //     transform: [token.args.fliplr ? "scaleX(-1)" : "", token.args.flipud ? "scaleY(-1)" : ""].join(" ") || undefined,
            //   },
            //   left: token.args.left ? parseInt(token.args.left, 10) : 0,
            //   top: token.args.top ? parseInt(token.args.top, 10) : 0,
            //   opacity: (token.args.opacity ? parseInt(token.args.opacity, 10) : 0) / 255,
            // })
            append(<Tag command={token} color="red"/>)
            break
          case "fadein":
          case "bg":
            if (token.args.layer && token.args.layer.startsWith("&")) {
              break
            }
            duplicateLastFrame(token.args.layer)
            pushBasicFrame(token, "bgimage/", token.args.file || token.args.storage, token.args.time, true)
            // pushFrame(token.args.layer, {
            //   time: time + (token.args.time ? parseInt(token.args.time, 10) : 0),
            //   contents: {
            //     image: token.args.file || token.args.storage,
            //     folder: "bgimage/",
            //     key: !lastContents(token.args.layer).key,
            //     transform: [token.args.fliplr ? "scaleX(-1)" : "", token.args.flipud ? "scaleY(-1)" : ""].join(" ") || undefined,
            //   },
            //   left: 0,
            //   top: 0,
            // })
            clearOtherLayers(token.args.layer)

            time += (token.args.time ? parseInt(token.args.time, 10) : 0)

            append(<Tag command={token} color="red"/>)
            break
          case "move":
            if (token.args.layer && token.args.layer.startsWith("&")) {
              break
            }
            duplicateLastFrame(token.args.layer)

            let nodes = []
            const pathRegex = /\((-?\d+),(-?\d+),(-?\d+)\)/y // read as many as we have
            let node
            while ((node = pathRegex.exec(token.args.path)) !== null) {
              nodes.push(node)
            }

            let moveTime = parseInt(token.args.time, 10)
            nodes.forEach((node, nodeID) => {
              duplicateLastFrame(token.args.layer, {
                time: time + moveTime * (1 + nodeID) / nodes.length,
                left: parseInt(node[1], 10),
                top: parseInt(node[2], 10),
                opacity: parseInt(node[3], 10) / 255,
                acceleration: token.args.accel || 0,
              })
            })

            moveTime += time
            endTime = endTime > moveTime ? endTime : moveTime
            append(<Tag command={token} color="red"/>)
            break
          case "wm":
            time = time > endTime ? time : endTime
            append(<Tag command={token} color="red"/>)
            break
          case "wait":
            time += parseInt(token.args.time, 10) || 0
            append(<Tag command={token} color="red"/>)
            break
          case "r":
            append(<div className="newline"/>)
            break
          case "cm":
            append(<div style={{height: "3em"}}/>)
            break
          case "macro":
            // on creation of a macro, there's nothing to render unless debugging
            if (debug) {
              append(<div style={{color: "darkred", marginLeft: "2em", border: "1px solid green"}}>
                {token.tokens.map(token => (<Tag command={token}/>))}
              </div>)
            }
            break
          case "return":
            // append(<div>--- returning from {token.from} (to {token.to}) ---</div>)
            break
          case "s":
            append("--- page generation halted at [s] ---")
            break
          default:
        }
        break
      case "EOF":
        append(<div>--- end of {token.storage} ---</div>)
        break
      case "call": // jump or call statements require more page loading
        append(<Interpreter gameState={token.gameState}
                            storage={token.storage}
                            target={token.target}
                            returnFrame={token.returnFrame}/>)
        break
      default:
        console.log("warning: unhandled token type: " + token.type, token)
    }
  })

  // save final frame for next animation block to use
  layerContents = []
  layers.forEach((animation, layer) => {
    layerContents[layer] = [Object.assign({}, animation[animation.length - 1], {time: 0})]
  })


  if (isDivider) {
    // determine transition
    // determine reverse transition
    append(<ScrollDetect image={background}
                         id={uuid++}
                         folder={backgroundFolder}
                         layers={layers}
                         alt=""/>)
  }
  return layerContents
}

export default Parse
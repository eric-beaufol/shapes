import React from 'react'
import styles from './Home.css'
import * as THREE from 'three'
import { MeshLine, MeshLineMaterial } from 'three.meshline'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass'
import { GlitchPass } from 'three/examples/jsm/postprocessing/GlitchPass'
import { DotScreenShader } from 'three/examples/jsm/shaders/DotScreenShader'
import { BloomPass } from 'three/examples/jsm/postprocessing/BloomPass'
import { FilmPass } from 'three/examples/jsm/postprocessing/FilmPass'
import { RGBShiftShader } from 'three/examples/jsm/shaders/RGBShiftShader'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { Reflector } from 'three/examples/jsm/objects/Reflector'
import bicep from '../../static/audio/bicep-glue.mp4'
import Stats from 'stats.js'
import dat from 'dat.gui'

// THREE
let scene, camera, renderer, controls, cubes = [], maxCubes = 8, composer, then = 0, gui

// Web audio API
let audioCtx, analyser, audio, dataArray

// Stats.js
let stats

class Home extends React.Component {

  constructor(props) {
    super(props)
    
    this.rGBAmount = 0.0015
    this.speed = 3
    this.amplitude = 0.6
    this.scaleDelta = .103

    this.canvas = React.createRef()
    this.animate = this.animate.bind(this)
  }

  componentDidMount() {

    // Dat.gui
    gui = new dat.GUI()
    
    gui.add(this, 'speed', .1, 3).step(.1)
    gui.add(this, 'amplitude', .1, 3).step(.1)
    gui.add(this, 'scaleDelta', .001, 0.5)

    this.initScene()
    this.initAudio()
    this.createCubes()
    this.addPasses()

    // Stats.js
    stats = new Stats()
    document.body.appendChild(stats.domElement)

    requestAnimationFrame(this.animate)

    window.addEventListener('click', this.handleClick)
  }

  handleClick(e) {
    e.preventDefault()
    audio.play()
  }

  initScene() {
    // THREE

    renderer = new THREE.WebGLRenderer({antialias: true, canvas: this.canvas})
    renderer.setSize(innerWidth, innerHeight)
    renderer.setPixelRatio(devicePixelRatio)

    scene = new THREE.Scene()
    
    camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, .01, 50)
    camera.position.y = 0
    camera.position.z = 4

    // const gridHelper = new THREE.GridHelper()
    // scene.add(gridHelper)

    const ambientLight = new THREE.AmbientLight(0xffffff, 2)
    scene.add(ambientLight)

    controls = new OrbitControls(camera, renderer.domElement)
    controls.minDistance = 0
    controls.maxDistance = 1000
    // controls.autoRotate = true
    controls.autoRotateSpeed = 10
    controls.enableDamping = true
    // controls.enabled = false
  }

  initAudio() {
    audio = document.createElement('audio')
    audio.src = bicep

    audioCtx = new (AudioContext || webkitAudioContext)()
    analyser = audioCtx.createAnalyser()

    const source = audioCtx.createMediaElementSource(audio)
    source.connect(analyser)
    analyser.connect(audioCtx.destination)

    analyser.fftSize = 256
    const bufferLength = analyser.frequencyBinCount
    dataArray = new Uint8Array(bufferLength)
  }

  addPasses() {
    composer = new EffectComposer(renderer)
    composer.setSize(this.canvas.width, this.canvas.height)
      
    composer.addPass(new RenderPass(scene, camera))
    let bloomPass = new BloomPass(
      2,    // strength
      25,   // kernel size
      3,    // sigma ?
      1024,  // blur render target resolution
    )
    bloomPass.enabled = false
    composer.addPass(bloomPass)

    const filmPass = new FilmPass(
      0.35,   // noise intensity
      0.767,  // scanline intensity
      182,    // scanline count
      false,  // grayscale
    )
    
    composer.addPass(filmPass)
    filmPass.enabled = false

    const dotScreenShader = new ShaderPass(DotScreenShader)
    dotScreenShader.uniforms['scale'].value = 11.9
    composer.addPass(dotScreenShader)
    dotScreenShader.enabled = false

    const rGBShiftShader = new ShaderPass(RGBShiftShader)
    rGBShiftShader.uniforms['amount'].value = -0.005
    composer.addPass(rGBShiftShader)

    const glitchPass = new GlitchPass()
    composer.addPass(glitchPass)
    glitchPass.enabled = false

    const bloomFolder = gui.addFolder('bloom')
    bloomFolder.add(bloomPass.copyUniforms.opacity, 'value', 0, 10).name('opacity')
    bloomFolder.add(bloomPass, 'enabled')
    
    const rgbShiftFolder = gui.addFolder('rgb shift')
    rgbShiftFolder.add(rGBShiftShader.uniforms.amount, 'value', -0.1, .1).name('value')
    rgbShiftFolder.add(rGBShiftShader, 'enabled')
    
    const filmPassFolder = gui.addFolder('film pass')
    filmPassFolder.add(filmPass.uniforms.nIntensity, 'value', 0, 1).name('noise intensity')
    filmPassFolder.add(filmPass.uniforms.sIntensity, 'value', 0, 1).name('intensity')
    filmPassFolder.add(filmPass.uniforms.sCount, 'value', 0, 1000).name('count')
    filmPassFolder.add(filmPass, 'enabled')
    
    const dotScreenFolder = gui.addFolder('dot screen')
    dotScreenFolder.add(dotScreenShader.uniforms.scale, 'value', .1, 20).name('scale')
    dotScreenFolder.add(dotScreenShader, 'enabled')

    const glitchFolder = gui.addFolder('glitch')
    glitchFolder.add(glitchPass, 'goWild')
    glitchFolder.add(glitchPass, 'enabled')
  }

  createCubes() {
    const material = new MeshLineMaterial({color: 0xffffff, lineWidth: .03})
    const baseGeo = new THREE.Geometry()

    const p1 = new THREE.Vector3(-1, -1, 0)
    const p2 = new THREE.Vector3(1, -1, 0)
    const p3 = new THREE.Vector3(1, 1, 0)
    const p4 = new THREE.Vector3(-1, 1, 0)

    baseGeo.vertices.push(p1, p2, p3, p4, p1)

    for (let i = 0; i < maxCubes; i++) {
      const object = new THREE.Object3D()

      const geo1 = baseGeo.clone().translate(0, 0, 1) // front
      const geo2 = baseGeo.clone().translate(0, 0, -1) // back
      const geo3 = baseGeo.clone().rotateX(Math.PI / 2).translate(0, -1, 0) // back
      const geo4 = baseGeo.clone().rotateX(Math.PI / 2).translate(0, 1, 0) // back

      const line1 = new MeshLine()
      line1.setGeometry(geo1)

      const line2 = new MeshLine()
      line2.setGeometry(geo2)

      const line3 = new MeshLine()
      line3.setGeometry(geo3)

      const line4 = new MeshLine()
      line4.setGeometry(geo4)

      const mesh1 = new THREE.Mesh(line1.geometry, material)
      const mesh2 = new THREE.Mesh(line2.geometry, material)
      const mesh3 = new THREE.Mesh(line3.geometry, material)
      const mesh4 = new THREE.Mesh(line4.geometry, material)
      
      object.add(mesh1)
      object.add(mesh2)
      object.add(mesh3)
      object.add(mesh4)

      const scale = 1 - i * this.scaleDelta
      object.scale.set(scale, scale, scale) 

      cubes.push(object)
      scene.add(object)
    }

    const options = {
      clipBias: 0.003,
      textureWidth: 512 * window.devicePixelRatio,
      textureHeight: 512 * window.devicePixelRatio,
      color: 0xffffff,
      recursion: 1
    } 

    const planeGeo = new THREE.PlaneBufferGeometry(2, 2)
    const frontMirror = new Reflector(planeGeo, options)
    const backMirror = new Reflector(planeGeo, options)
    const leftMirror = new Reflector(planeGeo, options)
    const rightMirror = new Reflector(planeGeo, options)
    const topMirror = new Reflector(planeGeo, options)
    const bottomMirror = new Reflector(planeGeo, options)

    frontMirror.position.z = 1
    backMirror.rotation.x = Math.PI
    backMirror.position.z = -1
    leftMirror.rotation.y = -Math.PI / 2
    leftMirror.position.x = -1
    rightMirror.rotation.y = Math.PI / 2
    rightMirror.position.x = 1
    topMirror.rotation.x = -Math.PI / 2
    topMirror.position.y = 1
    bottomMirror.rotation.x = Math.PI / 2
    bottomMirror.position.y = -1
    
    const lastMesh = new THREE.Object3D()
    lastMesh.add(frontMirror)
    lastMesh.add(backMirror)
    lastMesh.add(leftMirror)
    lastMesh.add(rightMirror)
    lastMesh.add(topMirror)
    lastMesh.add(bottomMirror)

    const lastScale = 1 - (maxCubes + .4) * this.scaleDelta
    lastMesh.scale.set(lastScale, lastScale, lastScale)
    // cubes.push(lastMesh)
    // scene.add(lastMesh)
  }

  animate(now) {
    requestAnimationFrame(this.animate)
    now *= 0.001
    const deltaTime = now - then
    then = now

    stats.begin()

    cubes.forEach((mesh, ndx) => {
      const delay = 0.15
      const delta = 0.15 * (ndx + 1)
      const scale = 0.5 + (Math.cos(now) * 0.5) * (1 - ndx * this.scaleDelta)
      // console.log(scale)

      mesh.scale.set(scale, scale, scale) 

      mesh.rotation.x = Math.cos(now * this.speed + ndx * delay) * this.amplitude * delta
      mesh.rotation.y = Math.sin(now * this.speed + ndx * delay) * this.amplitude * delta
      mesh.rotation.z = Math.cos(now * this.speed + ndx * delay) * this.amplitude * delta
    })

    composer.render(deltaTime)
    controls.update()

    analyser.getByteTimeDomainData(dataArray)
    console.log(dataArray)

    stats.end()
  }

  render() {
    return (
      <div className={styles.container}>
        <canvas ref={el => { this.canvas = el }}/>
      </div>
    )
  }
}

export default Home;
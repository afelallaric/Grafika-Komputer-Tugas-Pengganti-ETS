import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

let isRunning = false;
let massRatio = 1;
let startPoint = 5;
let startSpeed = 1.5;
let startDirection = 90;

let scene, camera, renderer;
let smallBody, massiveBody, surface, wireframe, trail, trailMassive;
let velocity = { x: 0, y: 0 };
let position = { x: 0, y: 0 };
let velocityMassive = { x: 0, y: 0 };
let positionMassive = { x: 0, y: 0 };
let trailPoints = [];
let trailPointsMassive = [];

let isDragging = false;
let previousMouse = { x: 0, y: 0 };

const container = document.getElementById('canvas-container');
const massRatioInput = document.getElementById('mass-ratio');
const startPointInput = document.getElementById('start-point');
const startSpeedInput = document.getElementById('start-speed');
const startDirectionInput = document.getElementById('start-direction');
const startBtn = document.getElementById('start-btn');
const resetBtn = document.getElementById('reset-btn');

massRatioInput.addEventListener('input', (e) => {
    massRatio = parseFloat(e.target.value);
    document.getElementById('mass-value').textContent = massRatio.toFixed(1);
    updateSmallBodySize();
});

startPointInput.addEventListener('input', (e) => {
    startPoint = parseFloat(e.target.value);
    document.getElementById('point-value').textContent = startPoint.toFixed(1);
});

startSpeedInput.addEventListener('input', (e) => {
    startSpeed = parseFloat(e.target.value);
    document.getElementById('speed-value').textContent = startSpeed.toFixed(2);
});

startDirectionInput.addEventListener('input', (e) => {
    startDirection = parseFloat(e.target.value);
    document.getElementById('direction-value').textContent = startDirection;
});

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000510);

    camera = new THREE.PerspectiveCamera(
        60,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(0, 15, 20);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(20, 25, 10); 
    scene.add(dirLight);

    const pointLight = new THREE.PointLight(0xffffff, 0.4, 100);
    pointLight.position.set(10, 10, 10);
    scene.add(pointLight);

    const gridSize = 40;
    const segments = 80;
    const planeGeometry = new THREE.PlaneGeometry(gridSize, gridSize, segments, segments);
    
    const planeMaterial = new THREE.MeshPhongMaterial({
        color: 0x2244ff,
        side: THREE.DoubleSide,
        wireframe: false,
        shininess: 30,
        transparent: true,
        opacity: 0.8
    });
    
    surface = new THREE.Mesh(planeGeometry, planeMaterial);
    surface.rotation.x = -Math.PI / 2;
    scene.add(surface);

    const wireframeGeometry = new THREE.PlaneGeometry(gridSize, gridSize, segments, segments);
    const wireframeMaterial = new THREE.MeshBasicMaterial({
        color: 0x4466ff,
        wireframe: true,
        transparent: true,
        opacity: 0.3
    });
    wireframe = new THREE.Mesh(wireframeGeometry, wireframeMaterial);
    wireframe.rotation.x = -Math.PI / 2;
    scene.add(wireframe);

    updateSurface(planeGeometry);
    updateSurface(wireframeGeometry);
    
    window.surfaceGeometries = {
        plane: planeGeometry,
        wireframe: wireframeGeometry
    };

    massiveBody = new THREE.Object3D(); 
    massiveBody.position.set(0, 0, 0);
    scene.add(massiveBody);

    const massiveSphereGeometry = new THREE.SphereGeometry(2, 32, 32);
    const massiveSphereMaterial = new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: 0x884400 });
    const massiveSphere = new THREE.Mesh(massiveSphereGeometry, massiveSphereMaterial);
    massiveSphere.name = "PlaceholderMassive";
    massiveBody.add(massiveSphere);

    const loader = new GLTFLoader();
    loader.load(
        "src/Earth/Earth.glb",
        (gltf) => {
            const placeholder = massiveBody.getObjectByName("PlaceholderMassive");
            if (placeholder) massiveBody.remove(placeholder);
            
            const earth = gltf.scene;
            const box = new THREE.Box3().setFromObject(earth);
            const center = new THREE.Vector3();
            box.getCenter(center);
            earth.position.sub(center);

            const size = new THREE.Vector3();
            box.getSize(size);
            const maxDim = Math.max(size.x, size.y, size.z) || 1;
            const targetSize = 4;
            const scale = targetSize / maxDim;
            earth.scale.setScalar(scale);

            earth.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    if (child.material) child.material.needsUpdate = true;
                }
            });

            massiveBody.add(earth);
            console.log("Earth.glb loaded & normalized");
        },
        undefined,
        (error) => {
            console.error("Failed to load Earth.glb, using placeholder.", error);
        }
    );

    smallBody = new THREE.Object3D(); 
    smallBody.position.set(startPoint, 0, 0);
    scene.add(smallBody);

    const smallSphereGeometry = new THREE.SphereGeometry(0.6, 32, 32);
    const smallSphereMaterial = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x004444 });
    const smallSphere = new THREE.Mesh(smallSphereGeometry, smallSphereMaterial);
    smallSphere.name = "PlaceholderSmall";
    smallBody.add(smallSphere);

    const moonLoader = new GLTFLoader();
    moonLoader.load(
        "src/Moon/Moon.glb",
        (gltf) => {
            const placeholder = smallBody.getObjectByName("PlaceholderSmall");
            if (placeholder) smallBody.remove(placeholder);
            
            const moon = gltf.scene;
            const box = new THREE.Box3().setFromObject(moon);
            const center = new THREE.Vector3();
            box.getCenter(center);
            moon.position.sub(center);

            const size = new THREE.Vector3();
            box.getSize(size);
            const maxDim = Math.max(size.x, size.y, size.z) || 1;
            const targetSize = 1.2;
            const scale = targetSize / maxDim;
            moon.scale.setScalar(scale);

            moon.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    if (child.material) child.material.needsUpdate = true;
                }
            });

            smallBody.add(moon);
            updateSmallBodySize();
            console.log("Moon.glb loaded & normalized");
        },
        undefined,
        (error) => {
            console.error("Failed to load Moon.glb, using placeholder.", error);
        }
    );

    const trailGeometry = new THREE.BufferGeometry();
    const trailMaterial = new THREE.LineBasicMaterial({ 
        color: 0x00ffff,
        transparent: true,
        opacity: 0.6
    });
    trail = new THREE.Line(trailGeometry, trailMaterial);
    scene.add(trail);
    
    const trailMassiveGeometry = new THREE.BufferGeometry();
    const trailMassiveMaterial = new THREE.LineBasicMaterial({ 
        color: 0xffaa00,
        transparent: true,
        opacity: 0.4
    });
    trailMassive = new THREE.Line(trailMassiveGeometry, trailMassiveMaterial);
    scene.add(trailMassive);

    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

    window.addEventListener('resize', onWindowResize);
}

function updateSurface(geometry) {
    const positions = geometry.attributes.position.array;

    const M_massive = 50;           
    const M_small = massRatio * 10; 
    const scaleWell = 0.4;          

    for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i];
        const z = positions[i + 1];

        const r1 = Math.sqrt(x * x + z * z) + 0.5;
        const depth1 = -(M_massive / 5) / (r1 * 0.5);   

        let depth2 = 0;
        if (isRunning && position.x !== undefined) {
            const dx = x - position.x;
            const dz = -z - position.y;
            const r2 = Math.sqrt(dx * dx + dz * dz) + 0.5;
            depth2 = -(M_small / 5) / (r2 * 0.8);       
        }

        positions[i + 2] = scaleWell * (depth1 + depth2);
    }

    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();
}

function updateSmallBodySize() {
    if (smallBody) {
        const baseScale = 0.5;          
        const scale = baseScale * massRatio;
        smallBody.scale.set(scale, scale, scale);
    }
}

function onMouseDown(e) {
    isDragging = true;
    previousMouse = { x: e.clientX, y: e.clientY };
}

function onMouseMove(e) {
    if (!isDragging) return;

    const deltaX = e.clientX - previousMouse.x;
    const deltaY = e.clientY - previousMouse.y;

    const radius = Math.sqrt(
        camera.position.x ** 2 + 
        camera.position.y ** 2 + 
        camera.position.z ** 2
    );

    const theta = Math.atan2(camera.position.x, camera.position.z);
    const phi = Math.acos(camera.position.y / radius);

    const newTheta = theta - deltaX * 0.01;
    const newPhi = Math.max(0.1, Math.min(Math.PI - 0.1, phi + deltaY * 0.01));

    camera.position.x = radius * Math.sin(newPhi) * Math.sin(newTheta);
    camera.position.y = radius * Math.cos(newPhi);
    camera.position.z = radius * Math.sin(newPhi) * Math.cos(newTheta);
    
    camera.lookAt(0, 0, 0);

    previousMouse = { x: e.clientX, y: e.clientY };
}

function onMouseUp() {
    isDragging = false;
}

function onWheel(e) {
    e.preventDefault();
    const radius = Math.sqrt(
        camera.position.x ** 2 + 
        camera.position.y ** 2 + 
        camera.position.z ** 2
    );
    
    const newRadius = Math.max(10, Math.min(50, radius + e.deltaY * 0.05));
    const scale = newRadius / radius;
    
    camera.position.multiplyScalar(scale);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);

    if (isRunning && smallBody && massiveBody) {
        const G = 0.25;
        const M1 = 50;
        const M2 = massRatio * 10;
        const dt = 0.016;

        const dx = position.x - positionMassive.x;
        const dy = position.y - positionMassive.y;
        const r = Math.sqrt(dx * dx + dy * dy);

        if (r > 1.2) {
            const forceMagnitude = (G * M1 * M2) / (r * r);
            
            const forceX = forceMagnitude * dx / r;
            const forceY = forceMagnitude * dy / r;
            
            const ax1 = -forceX / M2;
            const ay1 = -forceY / M2;
            
            velocity.x += ax1 * dt;
            velocity.y += ay1 * dt;

            position.x += velocity.x * dt;
            position.y += velocity.y * dt;

            const surfaceR1 = Math.sqrt(position.x * position.x + position.y * position.y) + 0.5;
            const surfaceDepth1 = -M1 / (surfaceR1 * 0.5 * 10);
            smallBody.position.set(position.x, surfaceDepth1 + 0.2, position.y);

            massiveBody.position.set(0, 0, 0);
            if (massiveBody.userData.glow) {
                massiveBody.userData.glow.position.set(0, 0, 0);
            }

            trailPoints.push(new THREE.Vector3(position.x, surfaceDepth1 + 0.2, position.y));
            if (trailPoints.length > 500) {
                trailPoints.shift();
            }

            const trailPositions = new Float32Array(trailPoints.length * 3);
            trailPoints.forEach((point, i) => {
                trailPositions[i * 3] = point.x;
                trailPositions[i * 3 + 1] = point.y;
                trailPositions[i * 3 + 2] = point.z;
            });
            trail.geometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
        } else {
            stopSimulation();
        }
    }
    
    if (window.surfaceGeometries) {
        updateSurface(window.surfaceGeometries.plane);
        updateSurface(window.surfaceGeometries.wireframe);
    }

    renderer.render(scene, camera);
}

function startSimulation() {
    const angle = 0;
    const directionRad = (startDirection * Math.PI) / 180;
    
    position = { 
        x: startPoint * Math.cos(angle), 
        y: startPoint * Math.sin(angle) 
    };
    velocity = { 
        x: startSpeed * Math.cos(directionRad), 
        y: startSpeed * Math.sin(directionRad) 
    };
    
    positionMassive = { x: 0, y: 0 };
    velocityMassive = { x: 0, y: 0 };
    
    trailPoints = [];
    trailPointsMassive = [];
    isRunning = true;
    
    startBtn.textContent = 'Running';
    startBtn.disabled = true;
    massRatioInput.disabled = true;
    startPointInput.disabled = true;
    startSpeedInput.disabled = true;
    startDirectionInput.disabled = true;
}

function stopSimulation() {
    isRunning = false;
    startBtn.textContent = 'Start';
    startBtn.disabled = false;
    massRatioInput.disabled = false;
    startPointInput.disabled = false;
    startSpeedInput.disabled = false;
    startDirectionInput.disabled = false;
}

function resetSimulation() {
    stopSimulation();
    const angle = 0;
    const directionRad = (startDirection * Math.PI) / 180;
    
    position = { 
        x: startPoint * Math.cos(angle), 
        y: startPoint * Math.sin(angle) 
    };
    velocity = { 
        x: startSpeed * Math.cos(directionRad), 
        y: startSpeed * Math.sin(directionRad) 
    };
    
    positionMassive = { x: 0, y: 0 };
    velocityMassive = { x: 0, y: 0 };
    
    trailPoints = [];
    trailPointsMassive = [];
    
    if (smallBody) {
        smallBody.position.set(position.x, 0, position.y);
    }
    
    if (massiveBody) {
        massiveBody.position.set(0, 0, 0);
        if (massiveBody.userData.glow) {
            massiveBody.userData.glow.position.set(0, 0, 0);
        }
    }
    
    trail.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));
}

startBtn.addEventListener('click', startSimulation);
resetBtn.addEventListener('click', resetSimulation);

init();
animate();
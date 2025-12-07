import * as THREE from 'three';

// Three.js renderer for 3D snake game
let scene, camera, renderer;
let snakeMeshes = new Map(); // playerId -> { group, segments, targetPositions, color, isAlive }
let appleGroup;
let animationId;

const GRID_SIZE = 20;
const FRUSTUM_SIZE = 24; // Adjusted to zoom in on smaller grid

export function init() {
  const canvas = document.getElementById('game-canvas');

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x4da6ff); // Bright blue sky

  // Camera at ~20-degree angle for better control alignment
  const aspect = window.innerWidth / window.innerHeight;
  camera = new THREE.OrthographicCamera(
    -FRUSTUM_SIZE * aspect / 2,
    FRUSTUM_SIZE * aspect / 2,
    FRUSTUM_SIZE / 2,
    -FRUSTUM_SIZE / 2,
    0.1,
    1000
  );

  // 70-degree rotation for better control alignment
  const distance = 40;
  const angle = Math.PI * 70 / 180; // 70 degrees
  camera.position.set(
    10 + distance * Math.cos(angle),
    distance * 0.7, // Height for better depth view
    10 + distance * Math.sin(angle)
  );
  camera.lookAt(10, 0, 10);

  // Renderer
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true; // Enable shadows for depth
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Enhanced lighting for 3D depth
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambientLight);

  // Main directional light with shadows
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
  directionalLight.position.set(20, 30, 20);
  directionalLight.castShadow = true;
  directionalLight.shadow.camera.left = -20;
  directionalLight.shadow.camera.right = 20;
  directionalLight.shadow.camera.top = 20;
  directionalLight.shadow.camera.bottom = -20;
  scene.add(directionalLight);

  // Rim light for depth
  const rimLight = new THREE.DirectionalLight(0x4466ff, 0.3);
  rimLight.position.set(-10, 10, -10);
  scene.add(rimLight);

  // Create grid
  createGrid();

  // Create apple group
  appleGroup = new THREE.Group();
  scene.add(appleGroup);

  // Handle window resize
  window.addEventListener('resize', onWindowResize);

  // Start animation loop
  animate();
}

function createGrid() {
  // Grid plane (floor) with shadows - Bright green
  const planeGeometry = new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE);
  const planeMaterial = new THREE.MeshStandardMaterial({
    color: 0x66ff66, // Bright green
    roughness: 0.8,
    metalness: 0.2
  });
  const plane = new THREE.Mesh(planeGeometry, planeMaterial);
  plane.rotation.x = -Math.PI / 2;
  plane.position.set(10, 0, 10);
  plane.receiveShadow = true;
  scene.add(plane);

  // Grid lines - Darker green
  const gridHelper = new THREE.GridHelper(GRID_SIZE, GRID_SIZE, 0x339933, 0x339933);
  gridHelper.position.set(10, 0.01, 10);
  scene.add(gridHelper);

  // Add border walls for depth perception - Brown
  const wallHeight = 1;
  const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0x8b4513, // Brown
    roughness: 0.7,
    metalness: 0.1,
    transparent: false,
    opacity: 1
  });

  // North wall
  const northWall = new THREE.Mesh(
    new THREE.BoxGeometry(GRID_SIZE, wallHeight, 0.2),
    wallMaterial
  );
  northWall.position.set(10, wallHeight / 2, 0);
  northWall.castShadow = true;
  scene.add(northWall);

  // South wall
  const southWall = new THREE.Mesh(
    new THREE.BoxGeometry(GRID_SIZE, wallHeight, 0.2),
    wallMaterial
  );
  southWall.position.set(10, wallHeight / 2, 20);
  southWall.castShadow = true;
  scene.add(southWall);

  // West wall
  const westWall = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, wallHeight, GRID_SIZE),
    wallMaterial
  );
  westWall.position.set(0, wallHeight / 2, 10);
  westWall.castShadow = true;
  scene.add(westWall);

  // East wall
  const eastWall = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, wallHeight, GRID_SIZE),
    wallMaterial
  );
  eastWall.position.set(20, wallHeight / 2, 10);
  eastWall.castShadow = true;
  scene.add(eastWall);
}

export function updateGameState(gameState) {
  // Update snakes
  gameState.players.forEach((player, index) => {
    const color = index === 0 ? 0x3399ff : 0xff66ff; // Player 1: bright blue, Player 2: bright pink

    if (!snakeMeshes.has(player.id)) {
      // Create new snake
      const group = new THREE.Group();
      scene.add(group);
      snakeMeshes.set(player.id, {
        group,
        segments: [],
        targetPositions: [],
        color,
        isAlive: player.isAlive
      });
    }

    const snakeData = snakeMeshes.get(player.id);
    snakeData.isAlive = player.isAlive;

    // Update target positions (backend x,y -> three.js x,z)
    // Make blocks taller for better 3D effect
    const blockHeight = 1.2;
    snakeData.targetPositions = player.snake.segments.map(seg => new THREE.Vector3(
      seg.x + 0.5,
      blockHeight / 2, // Center the taller block
      seg.y + 0.5
    ));

    // Add/remove cube meshes as needed
    while (snakeData.segments.length < player.snake.segments.length) {
      // Taller, more pronounced 3D blocks
      const geometry = new THREE.BoxGeometry(0.85, blockHeight, 0.85);
      const material = new THREE.MeshStandardMaterial({
        color: snakeData.color,
        emissive: snakeData.color,
        emissiveIntensity: 0.2,
        roughness: 0.3,
        metalness: 0.6
      });
      const cube = new THREE.Mesh(geometry, material);
      cube.castShadow = true;
      cube.receiveShadow = true;

      // Add subtle edge highlighting
      const edges = new THREE.EdgesGeometry(geometry);
      const edgeMaterial = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.3
      });
      const wireframe = new THREE.LineSegments(edges, edgeMaterial);
      cube.add(wireframe);

      snakeData.group.add(cube);
      snakeData.segments.push(cube);
    }

    while (snakeData.segments.length > player.snake.segments.length) {
      const cube = snakeData.segments.pop();
      snakeData.group.remove(cube);
    }

    // Death effect
    if (!player.isAlive) {
      snakeData.segments.forEach(cube => {
        cube.material.transparent = true;
        cube.material.opacity = 0.3;
      });
    }
  });

  // Update apples
  updateApples(gameState.apples);
}

function updateApples(apples) {
  // Clear existing apples
  while (appleGroup.children.length > 0) {
    appleGroup.remove(appleGroup.children[0]);
  }

  // Add new apples as glowing 3D blocks - Bright red
  apples.forEach(apple => {
    const appleHeight = 0.8;
    const geometry = new THREE.BoxGeometry(0.7, appleHeight, 0.7);
    const material = new THREE.MeshStandardMaterial({
      color: 0xff3333, // Bright red
      emissive: 0xff0000,
      emissiveIntensity: 0.4,
      roughness: 0.3,
      metalness: 0.6
    });
    const cube = new THREE.Mesh(geometry, material);
    cube.position.set(apple.x + 0.5, appleHeight / 2, apple.y + 0.5);
    cube.castShadow = true;
    cube.receiveShadow = true;

    // Add glowing edges to apples
    const edges = new THREE.EdgesGeometry(geometry);
    const edgeMaterial = new THREE.LineBasicMaterial({
      color: 0xff6666,
      transparent: true,
      opacity: 0.6
    });
    const wireframe = new THREE.LineSegments(edges, edgeMaterial);
    cube.add(wireframe);

    // Gentle rotation animation for visual interest
    cube.rotation.y = Math.random() * Math.PI;

    appleGroup.add(cube);
  });
}

function animate() {
  animationId = requestAnimationFrame(animate);

  const time = Date.now() * 0.001; // Time in seconds

  // Smooth snake movement with lerp
  for (const [, snakeData] of snakeMeshes) {
    snakeData.segments.forEach((cube, i) => {
      const target = snakeData.targetPositions[i];
      if (target) {
        cube.position.lerp(target, 0.3);
      }
    });
  }

  // Animate apples (rotation + subtle bobbing)
  appleGroup.children.forEach((apple, index) => {
    apple.rotation.y += 0.02;
    apple.position.y = 0.4 + Math.sin(time * 2 + index) * 0.1; // Gentle bobbing
  });

  renderer.render(scene, camera);
}

function onWindowResize() {
  const aspect = window.innerWidth / window.innerHeight;
  camera.left = -FRUSTUM_SIZE * aspect / 2;
  camera.right = FRUSTUM_SIZE * aspect / 2;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

export function cleanup() {
  // Stop animation
  if (animationId) {
    cancelAnimationFrame(animationId);
  }

  // Clear snakes
  for (const [, snakeData] of snakeMeshes) {
    scene.remove(snakeData.group);
  }
  snakeMeshes.clear();

  // Clear apples
  while (appleGroup.children.length > 0) {
    appleGroup.remove(appleGroup.children[0]);
  }
}

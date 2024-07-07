const socket = io();

const menu = document.getElementById('menu');
const multiplayerMenu = document.getElementById('multiplayerMenu');
const joinRoomMenu = document.getElementById('joinRoomMenu');
const roomDiv = document.getElementById('room');
const settings = document.getElementById('settings');
const gameDiv = document.getElementById('game');
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let playerSprite, weaponSprite, weaponAttackSprite, enemySprite, backgroundSprite;
let isGameOver = false;
let roomCode = '';
let isHost = false;
let spearThrown = false;
let spearPosition = { x: 0, y: 0 };
let spearVelocity = { x: 0, y: 0 };
let spearAngle = 0;

const playerHealthDisplay = document.getElementById('playerHealth');
const remainingEnemiesDisplay = document.getElementById('remainingEnemies');

function loadImage(src, fallbackSrc) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => {
            if (fallbackSrc) {
                const fallbackImg = new Image();
                fallbackImg.src = fallbackSrc;
                fallbackImg.onload = () => resolve(fallbackImg);
                fallbackImg.onerror = () => reject(new Error('Failed to load image.'));
            } else {
                reject(new Error('Failed to load image.'));
            }
        };
        img.src = src;
    });
}

async function loadAssets() {
    try {
        playerSprite = await loadImage('player.png', 'default_player.png');
        weaponSprite = await loadImage('weapon.png', 'default_weapon.png');
        weaponAttackSprite = await loadImage('weapon_attack.png', 'default_weapon_attack.png');
        enemySprite = await loadImage('enemy.png', 'default_enemy.png');
        backgroundSprite = await loadImage('background_tile.png', 'default_background_tile.png');
    } catch (error) {
        console.error('Error loading assets:', error);
    }
}

const player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    size: 20,
    color: 'white',
    speed: 5,
    health: 100,
    weapon: {
        angle: 0,
        length: 50,
        attack: false
    }
};

let keysPressed = {};
let enemies = [];
let currentStage = 1;
const maxStage = 5;
const baseEnemySpeed = 0.96; // Reduced speed to 0.8 times the original speed
const baseEnemyCount = 8;
let isAttacking = false;

const attackSound = new Audio('attack.mp3');
attackSound.onerror = () => {
    attackSound.src = 'default_attack.mp3';
};

const stageMusic = [
    new Audio('stage1.mp3'),
    new Audio('stage2.mp3'),
    new Audio('stage3.mp3'),
    new Audio('stage4.mp3'),
    new Audio('stage5.mp3')
];
stageMusic.forEach((audio, index) => {
    audio.onerror = () => {
        audio.src = `default_stage${index + 1}.mp3`;
    };
});

function updateHUD() {
    playerHealthDisplay.textContent = `Health: ${player.health}`;
    remainingEnemiesDisplay.textContent = `Enemies: ${enemies.length}`;
}

function showSettings() {
    hideAllMenus();
    settings.style.display = 'flex';
}

function backToMenu() {
    hideAllMenus();
    menu.style.display = 'flex';
    isGameOver = false;
}

function startLocalGame() {
    hideAllMenus();
    gameDiv.style.display = 'flex';
    startGame();
}

function showMultiplayerMenu() {
    hideAllMenus();
    multiplayerMenu.style.display = 'flex';
}

function showJoinRoom() {
    hideAllMenus();
    joinRoomMenu.style.display = 'flex';
}

function createRoom() {
    socket.emit('createRoom');
}

socket.on('roomCreated', (code) => {
    roomCode = code;
    isHost = true;
    hideAllMenus();
    roomDiv.style.display = 'flex';
    document.getElementById('roomCodeDisplay').textContent = `Room Code: ${roomCode}`;
});

function joinRoom() {
    const code = document.getElementById('roomCodeInput').value.trim();
    if (code) {
        socket.emit('joinRoom', code);
    }
}

socket.on('roomJoined', (code) => {
    roomCode = code;
    hideAllMenus();
    roomDiv.style.display = 'flex';
    document.getElementById('roomCodeDisplay').textContent = `Room Code: ${roomCode}`;
});

socket.on('updateRoom', (playerCount) => {
    if (playerCount === 2 && isHost) {
        document.getElementById('startGameButton').style.display = 'block';
    } else {
        document.getElementById('startGameButton').style.display = 'none';
    }
    document.getElementById('roomStatus').textContent = `Players: ${playerCount}/2`;
});

socket.on('startGame', () => {
    startMultiplayerGame();
});

function leaveRoom() {
    socket.emit('leaveRoom', roomCode);
    backToMenu();
}

function startMultiplayerGame() {
    hideAllMenus();
    gameDiv.style.display = 'flex';
    startGame();
}

function hideAllMenus() {
    menu.style.display = 'none';
    settings.style.display = 'none';
    multiplayerMenu.style.display = 'none';
    joinRoomMenu.style.display = 'none';
    roomDiv.style.display = 'none';
    gameDiv.style.display = 'none';
}

window.addEventListener('keydown', (e) => {
    keysPressed[e.key] = true;
    handlePlayerMovement();
    handleWeaponMovement(e);
});

window.addEventListener('keyup', (e) => {
    keysPressed[e.key] = false;
    if (e.key === 'ArrowUp') player.weapon.attack = false;
});

function handlePlayerMovement() {
    let dx = 0;
    let dy = 0;
    if (keysPressed['w']) dy -= player.speed;
    if (keysPressed['s']) dy += player.speed;
    if (keysPressed['a']) dx -= player.speed;
    if (keysPressed['d']) dx += player.speed;
    if (dx !== 0 && dy !== 0) {
        dx *= Math.sqrt(0.5);
        dy *= Math.sqrt(0.5);
    }
    player.x += dx;
    player.y += dy;
    if (player.x < 0) player.x = 0;
    if (player.y < 0) player.y = 0;
    if (player.x > canvas.width) player.x = canvas.width;
    if (player.y > canvas.height) player.y = canvas.height;
    sendPlayerMovement();
}

function handleWeaponMovement(e) {
    if (e.key === 'ArrowLeft') player.weapon.angle -= 0.1;
    if (e.key === 'ArrowRight') player.weapon.angle += 0.1;
    if (e.key === 'ArrowUp' && !spearThrown) {
        player.weapon.attack = true;
        throwSpear();
    }
    sendPlayerMovement();
}

function sendPlayerMovement() {
    socket.emit('playerMovement', {
        x: player.x,
        y: player.y,
        angle: player.weapon.angle,
        attack: player.weapon.attack
    });
}

socket.on('playerMovement', (data) => {
    player.x = data.x;
    player.y = data.y;
    player.weapon.angle = data.angle;
    player.weapon.attack = data.attack;
});

function throwSpear() {
    spearThrown = true;
    spearPosition.x = player.x;
    spearPosition.y = player.y;
    spearVelocity.x = Math.cos(player.weapon.angle) * 10;
    spearVelocity.y = Math.sin(player.weapon.angle) * 10;
    spearAngle = player.weapon.angle;
    attackSound.play();

    // Reset spear after 0.5 seconds
    setTimeout(() => {
        spearThrown = false;
    }, 500);
}

function updateSpear() {
    if (spearThrown) {
        spearPosition.x += spearVelocity.x;
        spearPosition.y += spearVelocity.y;

        // Check collision with enemies
        let enemiesToRemove = [];
        enemies.forEach((enemy, index) => {
            const enemyRect = {
                x: enemy.x,
                y: enemy.y,
                width: enemy.size,
                height: enemy.size
            };
            const spearRect = {
                x: spearPosition.x,
                y: spearPosition.y,
                width: 50, // Assuming the spear width
                height: 10  // Assuming the spear height
            };
            if (rectsOverlap(enemyRect, spearRect)) {
                enemiesToRemove.push(index);
            }
        });

        enemiesToRemove.forEach((index) => {
            enemies.splice(index, 1);
        });

        updateHUD();

        // Check if spear is out of bounds
        if (spearPosition.x < 0 || spearPosition.x > canvas.width || spearPosition.y < 0 || spearPosition.y > canvas.height) {
            spearThrown = false; // Reset spear
        }

        // Check if all enemies are defeated
        if (enemies.length === 0) {
            nextStage();
        }
    }
}

function rectsOverlap(rect1, rect2) {
    return !(rect1.x + rect1.width < rect2.x ||
             rect1.x > rect2.x + rect2.width ||
             rect1.y + rect1.height < rect2.y ||
             rect1.y > rect2.y + rect2.height);
}

function nextStage() {
    stageMusic[currentStage - 1].pause();
    currentStage++;
    if (currentStage <= maxStage) {
        alert('Stage ' + currentStage + ' starting!');
        spawnEnemies();
        stageMusic[currentStage - 1].play();
    } else {
        alert('You have completed all stages!');
        backToMenu();
    }
}

function spawnEnemies() {
    const enemyCount = baseEnemyCount + (currentStage - 1) * 2;
    for (let i = 0; i < enemyCount; i++) {
        enemies.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: 30,
            color: 'red',
            health: 3,
            speed: baseEnemySpeed + (currentStage - 1) * 0.5
        });
    }
    updateHUD();
}

function gameOver() {
    if (!isGameOver) {
        alert('Game Over');
        isGameOver = true;
        stageMusic[currentStage - 1].pause();
        backToMenu();
    }
}

function drawBackground() {
    const pattern = ctx.createPattern(backgroundSprite, 'repeat');
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background
    drawBackground();

    // Draw player
    ctx.drawImage(playerSprite, player.x - player.size / 2, player.y - player.size / 2, player.size, player.size);

    // Draw spear if thrown
    if (spearThrown) {
        ctx.save();
        ctx.translate(spearPosition.x, spearPosition.y);
        ctx.rotate(spearAngle);
        ctx.drawImage(weaponSprite, -25, -5, 50, 10);
        ctx.restore();
    } else {
        // Draw spear in hand rotating
        ctx.save();
        ctx.translate(player.x, player.y);
        ctx.rotate(player.weapon.angle);
        ctx.drawImage(weaponSprite, 0, -5, player.weapon.length, 10);
        ctx.restore();
    }

    // Update spear position
    updateSpear();

    // Update and draw enemies
    enemies.forEach((enemy) => {
        const angleToPlayer = Math.atan2(player.y - enemy.y, player.x - enemy.x);
        enemy.x += Math.cos(angleToPlayer) * enemy.speed;
        enemy.y += Math.sin(angleToPlayer) * enemy.speed;

        // Check collision with player
        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < player.size / 2 + enemy.size / 2) {
            player.health -= 1;
            if (player.health <= 0) {
                gameOver();
            }
        }

        ctx.drawImage(enemySprite, enemy.x - enemy.size / 2, enemy.y - enemy.size / 2, enemy.size, enemy.size);
    });

    updateHUD();

    if (!isGameOver) {
        requestAnimationFrame(gameLoop);
    }
}

async function startGame() {
    await loadAssets();
    alert('Stage 1 starting!');
    spawnEnemies();
    stageMusic[0].play();
    gameLoop();
}

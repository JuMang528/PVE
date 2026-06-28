/**
 * 飞机大战游戏 - 核心逻辑
 * 使用HTML5 Canvas进行图形渲染
 * 采用模块化设计，便于维护和扩展
 */

// === 游戏配置 ===
const CONFIG = {
    canvasWidth: 800,
    canvasHeight: 600,
    playerSpeed: 6,
    bulletSpeed: 12,
    enemyBaseSpeed: 2,
    baseSpawnRate: 60,
    maxEnemies: 8,
    playerLives: 3,
    bulletCooldown: 150,
    particleCount: 30,
};

// === 音效管理器 ===
class SoundManager {
    constructor() {
        this.volume = 0.8;
        this.bgmEnabled = true;
        this.audioContext = null;
        this.bgmOscillator = null;
        this.bgmGain = null;
    }

    init() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    playShoot() {
        this.playTone(800, 0.1, 'square');
    }

    playExplosion() {
        this.playTone(150, 0.3, 'sawtooth', 0.5);
    }

    playHit() {
        this.playTone(200, 0.15, 'triangle');
    }

    playPowerUp() {
        this.playTone(500, 0.2, 'sine');
        setTimeout(() => this.playTone(800, 0.2, 'sine'), 100);
    }

    playTone(frequency, duration, type = 'sine', volume = 0.3) {
        if (!this.audioContext) return;
        
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        
        gain.gain.setValueAtTime(volume * this.volume, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
        
        osc.connect(gain);
        gain.connect(this.audioContext.destination);
        
        osc.start();
        osc.stop(this.audioContext.currentTime + duration);
    }

    startBGM() {
        if (!this.bgmEnabled || !this.audioContext) return;
        
        this.bgmOscillator = this.audioContext.createOscillator();
        this.bgmGain = this.audioContext.createGain();
        
        this.bgmOscillator.type = 'sine';
        this.bgmOscillator.frequency.setValueAtTime(220, this.audioContext.currentTime);
        
        this.bgmGain.gain.setValueAtTime(0.05 * this.volume, this.audioContext.currentTime);
        
        this.bgmOscillator.connect(this.bgmGain);
        this.bgmGain.connect(this.audioContext.destination);
        
        this.bgmOscillator.start();
        
        // 简单的旋律循环
        this.bgmLoop();
    }

    bgmLoop() {
        if (!this.bgmOscillator) return;
        
        const notes = [220, 262, 294, 330, 349, 392, 440, 440];
        let index = 0;
        
        const playNote = () => {
            if (!this.bgmOscillator) return;
            this.bgmOscillator.frequency.setValueAtTime(notes[index], this.audioContext.currentTime);
            index = (index + 1) % notes.length;
            setTimeout(playNote, 400);
        };
        
        playNote();
    }

    stopBGM() {
        if (this.bgmOscillator) {
            this.bgmOscillator.stop();
            this.bgmOscillator = null;
        }
    }

    setVolume(value) {
        this.volume = value / 100;
        if (this.bgmGain) {
            this.bgmGain.gain.setValueAtTime(0.05 * this.volume, this.audioContext.currentTime);
        }
    }

    setBGMEnabled(enabled) {
        this.bgmEnabled = enabled;
        if (enabled) {
            this.startBGM();
        } else {
            this.stopBGM();
        }
    }
}

// === 粒子系统 ===
class ParticleSystem {
    constructor(game) {
        this.game = game;
        this.particles = [];
        this.enabled = true;
    }

    createExplosion(x, y, color = '#ff6600', count = 20) {
        if (!this.enabled) return;
        
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 5 + 2;
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1,
                decay: Math.random() * 0.03 + 0.02,
                color: color,
                size: Math.random() * 4 + 2
            });
        }
    }

    createTrail(x, y, color = '#00ffff') {
        if (!this.enabled) return;
        
        this.particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 2,
            vy: Math.random() * 2,
            life: 0.5,
            decay: 0.05,
            color: color,
            size: Math.random() * 3 + 1
        });
    }

    update() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= p.decay;
            p.vx *= 0.95;
            p.vy *= 0.95;
            
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    render(ctx) {
        for (const p of this.particles) {
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }
}

// === 实体类 ===
class GameObject {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.active = true;
    }

    getBounds() {
        return {
            x: this.x - this.width / 2,
            y: this.y - this.height / 2,
            width: this.width,
            height: this.height
        };
    }

    isColliding(other) {
        const b1 = this.getBounds();
        const b2 = other.getBounds();
        return b1.x < b2.x + b2.width &&
               b1.x + b1.width > b2.x &&
               b1.y < b2.y + b2.height &&
               b1.y + b1.height > b2.y;
    }
}

// === 玩家类 ===
class Player extends GameObject {
    constructor(game) {
        super(game.width / 2, game.height - 80, 50, 60);
        this.game = game;
        this.lives = CONFIG.playerLives;
        this.score = 0;
        this.level = 1;
        this.speed = CONFIG.playerSpeed;
        this.bullets = [];
        this.lastShotTime = 0;
        this.invincible = false;
        this.invincibleTimer = 0;
        this.powerLevel = 1;
        this.fireRate = CONFIG.bulletCooldown;
        this.color = '#00ffff';
    }

    update(deltaTime, keys) {
        // 移动
        if (keys['ArrowUp'] || keys['KeyW']) this.y -= this.speed;
        if (keys['ArrowDown'] || keys['KeyS']) this.y += this.speed;
        if (keys['ArrowLeft'] || keys['KeyA']) this.x -= this.speed;
        if (keys['ArrowRight'] || keys['KeyD']) this.x += this.speed;

        // 边界限制
        this.x = Math.max(this.width / 2, Math.min(this.game.width - this.width / 2, this.x));
        this.y = Math.max(this.height / 2, Math.min(this.game.height - this.height / 2, this.y));

        // 自动射击
        if (keys['Space']) {
            this.shoot();
        }

        // 更新无敌状态
        if (this.invincible) {
            this.invincibleTimer -= deltaTime;
            if (this.invincibleTimer <= 0) {
                this.invincible = false;
            }
        }

        // 更新子弹
        this.bullets.forEach(b => b.update());
        this.bullets = this.bullets.filter(b => b.active);

        // 生成尾迹
        if (this.game.settings.particlesEnabled) {
            this.game.particles.createTrail(this.x - 15, this.y + 10, this.color);
            this.game.particles.createTrail(this.x + 15, this.y + 10, this.color);
        }
    }

    shoot() {
        const now = Date.now();
        if (now - this.lastShotTime < this.fireRate) return;
        this.lastShotTime = now;

        this.game.sounds.playShoot();

        if (this.powerLevel >= 1) {
            // 单发子弹
            this.bullets.push(new Bullet(this.game, this.x, this.y - this.height / 2, 0, -CONFIG.bulletSpeed));
        }

        if (this.powerLevel >= 2) {
            // 双发子弹
            this.bullets.push(new Bullet(this.game, this.x - 15, this.y - this.height / 2 + 10, -1, -CONFIG.bulletSpeed));
            this.bullets.push(new Bullet(this.game, this.x + 15, this.y - this.height / 2 + 10, 1, -CONFIG.bulletSpeed));
        }

        if (this.powerLevel >= 3) {
            // 三发散射子弹
            this.bullets.push(new Bullet(this.game, this.x, this.y - this.height / 2, 0, -CONFIG.bulletSpeed));
            this.bullets.push(new Bullet(this.game, this.x - 20, this.y - this.height / 2, -2, -CONFIG.bulletSpeed));
            this.bullets.push(new Bullet(this.game, this.x + 20, this.y - this.height / 2, 2, -CONFIG.bulletSpeed));
        }
    }

    takeDamage() {
        if (this.invincible) return;
        
        this.lives--;
        this.invincible = true;
        this.invincibleTimer = 2000;
        this.game.sounds.playHit();
        
        if (this.lives > 0) {
            this.powerLevel = Math.max(1, this.powerLevel - 1);
            this.game.particles.createExplosion(this.x, this.y, '#ff4444', 30);
        } else {
            this.game.particles.createExplosion(this.x, this.y, '#ff0000', 50);
            this.active = false;
        }
    }

    addScore(points) {
        this.score += points;
        this.updateLevel();
        this.game.updateHUD();
    }

    updateLevel() {
        const newLevel = Math.floor(this.score / 1000) + 1;
        if (newLevel > this.level) {
            this.level = newLevel;
            this.game.updateDifficulty();
        }
    }

    render(ctx) {
        // 无敌闪烁效果
        if (this.invincible && Math.floor(Date.now() / 100) % 2 === 0) {
            ctx.globalAlpha = 0.5;
        }

        // 绘制飞机主体
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y - this.height / 2);
        ctx.lineTo(this.x - this.width / 2, this.y + this.height / 2);
        ctx.lineTo(this.x - this.width / 4, this.y + this.height / 3);
        ctx.lineTo(this.x + this.width / 4, this.y + this.height / 3);
        ctx.lineTo(this.x + this.width / 2, this.y + this.height / 2);
        ctx.closePath();
        ctx.fill();

        // 绘制驾驶舱
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(this.x, this.y - 5, 8, 12, 0, 0, Math.PI * 2);
        ctx.fill();

        // 绘制引擎火焰
        ctx.fillStyle = '#ff6600';
        ctx.beginPath();
        ctx.moveTo(this.x - 10, this.y + this.height / 3);
        ctx.lineTo(this.x, this.y + this.height / 2 + Math.random() * 10 + 5);
        ctx.lineTo(this.x + 10, this.y + this.height / 3);
        ctx.closePath();
        ctx.fill();

        // 绘制子弹
        this.bullets.forEach(b => b.render(ctx));

        ctx.globalAlpha = 1;
    }
}

// === 敌机类 ===
class Enemy extends GameObject {
    constructor(game, type) {
        const types = {
            small: { width: 30, height: 30, speed: 3, health: 1, score: 100, color: '#ff6600', fireRate: 2000 },
            medium: { width: 50, height: 45, speed: 2, health: 3, score: 250, color: '#ff0066', fireRate: 1500 },
            large: { width: 70, height: 60, speed: 1, health: 6, score: 500, color: '#ff0000', fireRate: 1000 },
            boss: { width: 120, height: 100, speed: 1, health: 20, score: 2000, color: '#8800ff', fireRate: 500 }
        };
        
        const config = types[type] || types.small;
        super(Math.random() * (game.width - config.width) + config.width / 2, -config.height, config.width, config.height);
        
        this.game = game;
        this.type = type;
        this.speed = config.speed;
        this.health = config.health;
        this.maxHealth = config.health;
        this.scoreValue = config.score;
        this.color = config.color;
        this.fireRate = config.fireRate;
        this.lastShotTime = 0;
        this.bullets = [];
        this.movePattern = Math.random() > 0.5 ? 'zigzag' : 'straight';
        this.moveTimer = 0;
        this.moveDirection = 1;
    }

    update(deltaTime) {
        // 移动
        this.y += this.speed;
        
        if (this.movePattern === 'zigzag') {
            this.moveTimer += deltaTime;
            if (this.moveTimer > 500) {
                this.moveDirection *= -1;
                this.moveTimer = 0;
            }
            this.x += this.moveDirection * 2;
        }

        // 边界限制
        this.x = Math.max(this.width / 2, Math.min(this.game.width - this.width / 2, this.x));

        // 射击（中大型敌机）
        if (this.type !== 'small' && this.y > 50) {
            const now = Date.now();
            if (now - this.lastShotTime > this.fireRate) {
                this.lastShotTime = now;
                this.shoot();
            }
        }

        // 更新子弹
        this.bullets.forEach(b => b.update());
        this.bullets = this.bullets.filter(b => b.active);

        // 超出屏幕
        if (this.y > this.game.height + this.height) {
            this.active = false;
        }
    }

    shoot() {
        this.game.sounds.playShoot();
        
        if (this.type === 'large' || this.type === 'boss') {
            // 多发子弹
            this.bullets.push(new Bullet(this.game, this.x, this.y + this.height / 2, 0, 6));
            this.bullets.push(new Bullet(this.game, this.x - 20, this.y + this.height / 2, -1, 6));
            this.bullets.push(new Bullet(this.game, this.x + 20, this.y + this.height / 2, 1, 6));
        } else {
            this.bullets.push(new Bullet(this.game, this.x, this.y + this.height / 2, 0, 5));
        }
    }

    takeDamage(damage = 1) {
        this.health -= damage;
        if (this.health <= 0) {
            this.active = false;
            this.game.sounds.playExplosion();
            this.game.particles.createExplosion(this.x, this.y, this.color, 30);
            this.game.player.addScore(this.scoreValue);
            this.game.spawnPowerUp(this.x, this.y, this.type);
        }
    }

    render(ctx) {
        // 绘制敌机主体
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y + this.height / 2);
        ctx.lineTo(this.x - this.width / 2, this.y - this.height / 2);
        ctx.lineTo(this.x - this.width / 4, this.y - this.height / 4);
        ctx.lineTo(this.x + this.width / 4, this.y - this.height / 4);
        ctx.lineTo(this.x + this.width / 2, this.y - this.height / 2);
        ctx.closePath();
        ctx.fill();

        // 绘制血条（中大型敌机）
        if (this.type !== 'small') {
            const healthPercent = this.health / this.maxHealth;
            ctx.fillStyle = '#333';
            ctx.fillRect(this.x - this.width / 2, this.y - this.height / 2 - 10, this.width, 5);
            ctx.fillStyle = healthPercent > 0.5 ? '#00ff00' : healthPercent > 0.25 ? '#ffff00' : '#ff0000';
            ctx.fillRect(this.x - this.width / 2, this.y - this.height / 2 - 10, this.width * healthPercent, 5);
        }

        // 绘制子弹
        this.bullets.forEach(b => b.render(ctx));
    }
}

// === 子弹类 ===
class Bullet extends GameObject {
    constructor(game, x, y, vx, vy) {
        super(x, y, 6, 12);
        this.game = game;
        this.vx = vx;
        this.vy = vy;
        this.color = '#00ffff';
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;

        // 超出屏幕
        if (this.y < -this.height || this.y > this.game.height + this.height ||
            this.x < -this.width || this.x > this.game.width + this.width) {
            this.active = false;
        }
    }

    render(ctx) {
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 10;
        ctx.fillRect(this.x - this.width / 2, this.y - this.height / 2, this.width, this.height);
        ctx.shadowBlur = 0;
    }
}

// === 道具类 ===
class PowerUp extends GameObject {
    constructor(game, x, y) {
        super(x, y, 30, 30);
        this.game = game;
        this.types = ['power', 'life', 'speed'];
        this.type = this.types[Math.floor(Math.random() * this.types.length)];
        this.speed = 2;
        this.color = this.getColor();
    }

    getColor() {
        switch (this.type) {
            case 'power': return '#ffff00';
            case 'life': return '#ff00ff';
            case 'speed': return '#00ff00';
            default: return '#ffffff';
        }
    }

    update() {
        this.y += this.speed;
        
        if (this.y > this.game.height + this.height) {
            this.active = false;
        }
    }

    applyEffect(player) {
        this.game.sounds.playPowerUp();
        
        switch (this.type) {
            case 'power':
                player.powerLevel = Math.min(3, player.powerLevel + 1);
                break;
            case 'life':
                player.lives = Math.min(5, player.lives + 1);
                break;
            case 'speed':
                player.fireRate = Math.max(50, player.fireRate - 20);
                break;
        }
        
        this.game.particles.createExplosion(this.x, this.y, this.color, 20);
        this.active = false;
    }

    render(ctx) {
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.width / 2, 0, Math.PI * 2);
        ctx.fill();
        
        // 图标
        ctx.fillStyle = '#000';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const icon = this.type === 'power' ? 'P' : this.type === 'life' ? '+' : 'S';
        ctx.fillText(icon, this.x, this.y);
        ctx.shadowBlur = 0;
    }
}

// === 游戏主类 ===
class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.width = CONFIG.canvasWidth;
        this.height = CONFIG.canvasHeight;
        
        this.state = 'start'; // start, playing, paused, gameover
        this.keys = {};
        this.lastTime = 0;
        
        this.player = null;
        this.enemies = [];
        this.powerUps = [];
        this.particles = null;
        this.sounds = null;
        
        this.spawnTimer = 0;
        this.spawnRate = CONFIG.baseSpawnRate;
        this.enemyTypes = ['small', 'medium', 'large'];
        
        this.settings = {
            soundVolume: 80,
            bgmEnabled: true,
            particlesEnabled: true,
            graphicsQuality: 'high'
        };
        
        this.init();
    }

    init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        // 键盘事件
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            if (e.code === 'KeyP') {
                if (this.state === 'playing') this.pause();
                else if (this.state === 'paused') this.resume();
            }
        });
        
        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
        
        // 暂停按钮
        document.getElementById('pauseBtn').addEventListener('click', () => {
            if (this.state === 'playing') this.pause();
        });
        
        // 加载设置
        this.loadSettings();
        
        // 初始化音效和粒子
        this.sounds = new SoundManager();
        this.particles = new ParticleSystem(this);
        this.particles.enabled = this.settings.particlesEnabled;
    }

    resize() {
        const container = document.getElementById('game-container');
        const maxWidth = container.clientWidth - 20;
        const maxHeight = container.clientHeight - 20;
        
        const aspectRatio = this.width / this.height;
        let newWidth = maxWidth;
        let newHeight = maxWidth / aspectRatio;
        
        if (newHeight > maxHeight) {
            newHeight = maxHeight;
            newWidth = maxHeight * aspectRatio;
        }
        
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.canvas.style.width = `${newWidth}px`;
        this.canvas.style.height = `${newHeight}px`;
    }

    start() {
        this.hideAllScreens();
        this.player = new Player(this);
        this.enemies = [];
        this.powerUps = [];
        this.particles.particles = [];
        this.spawnRate = CONFIG.baseSpawnRate;
        this.state = 'playing';
        
        this.sounds.init();
        if (this.settings.bgmEnabled) {
            this.sounds.startBGM();
        }
        
        this.updateHUD();
        this.gameLoop();
    }

    pause() {
        this.state = 'paused';
        this.sounds.stopBGM();
        document.getElementById('pauseScreen').classList.remove('hidden');
    }

    resume() {
        this.state = 'playing';
        document.getElementById('pauseScreen').classList.add('hidden');
        if (this.settings.bgmEnabled) {
            this.sounds.startBGM();
        }
        this.gameLoop();
    }

    restart() {
        this.start();
    }

    gameOver() {
        this.state = 'gameover';
        this.sounds.stopBGM();
        
        // 更新最高分
        const highScore = localStorage.getItem('highScore') || 0;
        if (this.player.score > highScore) {
            localStorage.setItem('highScore', this.player.score);
        }
        
        document.getElementById('finalScore').textContent = this.player.score;
        document.getElementById('highScore').textContent = `最高分: ${localStorage.getItem('highScore')}`;
        document.getElementById('gameOverScreen').classList.remove('hidden');
    }

    update(deltaTime) {
        if (this.state !== 'playing') return;
        
        // 更新玩家
        this.player.update(deltaTime, this.keys);
        
        // 生成敌机
        this.spawnTimer += deltaTime;
        if (this.spawnTimer > this.spawnRate && this.enemies.length < CONFIG.maxEnemies) {
            this.spawnEnemy();
            this.spawnTimer = 0;
        }
        
        // 更新敌机
        this.enemies.forEach(e => e.update(deltaTime));
        this.enemies = this.enemies.filter(e => e.active);
        
        // 更新道具
        this.powerUps.forEach(p => p.update());
        this.powerUps = this.powerUps.filter(p => p.active);
        
        // 更新粒子
        this.particles.update();
        
        // 碰撞检测
        this.checkCollisions();
    }

    spawnEnemy() {
        // 根据关卡选择敌机类型
        const rand = Math.random();
        let type;
        
        if (this.player.level >= 5) {
            // 高关卡出现Boss
            if (rand < 0.05) type = 'boss';
            else if (rand < 0.3) type = 'large';
            else if (rand < 0.6) type = 'medium';
            else type = 'small';
        } else if (this.player.level >= 3) {
            if (rand < 0.2) type = 'large';
            else if (rand < 0.5) type = 'medium';
            else type = 'small';
        } else if (this.player.level >= 2) {
            if (rand < 0.3) type = 'medium';
            else type = 'small';
        } else {
            type = 'small';
        }
        
        this.enemies.push(new Enemy(this, type));
    }

    spawnPowerUp(x, y, enemyType) {
        const dropRates = {
            small: 0.15,
            medium: 0.3,
            large: 0.5,
            boss: 1.0
        };
        
        const rate = dropRates[enemyType] || 0.15;
        
        if (Math.random() < rate) {
            this.powerUps.push(new PowerUp(this, x, y));
        }
    }

    checkCollisions() {
        // 玩家子弹与敌机
        this.player.bullets.forEach(bullet => {
            this.enemies.forEach(enemy => {
                if (bullet.isColliding(enemy)) {
                    bullet.active = false;
                    enemy.takeDamage();
                }
            });
        });
        
        // 敌机子弹与玩家
        this.enemies.forEach(enemy => {
            enemy.bullets.forEach(bullet => {
                if (bullet.isColliding(this.player)) {
                    bullet.active = false;
                    this.player.takeDamage();
                    
                    if (!this.player.active) {
                        this.gameOver();
                    }
                }
            });
        });
        
        // 敌机与玩家
        this.enemies.forEach(enemy => {
            if (enemy.isColliding(this.player)) {
                enemy.takeDamage(enemy.maxHealth);
                this.player.takeDamage();
                
                if (!this.player.active) {
                    this.gameOver();
                }
            }
        });
        
        // 道具与玩家
        this.powerUps.forEach(powerUp => {
            if (powerUp.isColliding(this.player)) {
                powerUp.applyEffect(this.player);
                this.updateHUD();
            }
        });
    }

    updateDifficulty() {
        // 增加难度
        this.spawnRate = Math.max(20, CONFIG.baseSpawnRate - this.player.level * 5);
    }

    updateHUD() {
        document.getElementById('score').textContent = this.player.score;
        document.getElementById('level').textContent = this.player.level;
        
        const lifeBar = document.getElementById('lifeBar');
        lifeBar.innerHTML = '';
        for (let i = 0; i < 5; i++) {
            const life = document.createElement('div');
            life.className = `life ${i < this.player.lives ? '' : 'lost'}`;
            lifeBar.appendChild(life);
        }
    }

    render() {
        // 清空画布
        this.ctx.fillStyle = '#0a0a1a';
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // 绘制星空背景
        this.drawStars();
        
        // 绘制游戏元素
        if (this.player && this.player.active) {
            this.player.render(this.ctx);
        }
        
        this.enemies.forEach(e => e.render(this.ctx));
        this.powerUps.forEach(p => p.render(this.ctx));
        this.particles.render(this.ctx);
    }

    drawStars() {
        this.ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 100; i++) {
            const x = (i * 37 + Date.now() / 100) % this.width;
            const y = (i * 59) % this.height;
            const size = (i % 3) + 1;
            this.ctx.globalAlpha = 0.3 + (i % 7) * 0.1;
            this.ctx.beginPath();
            this.ctx.arc(x, y, size, 0, Math.PI * 2);
            this.ctx.fill();
        }
        this.ctx.globalAlpha = 1;
    }

    gameLoop(currentTime = 0) {
        if (this.state !== 'playing') return;
        
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        this.update(deltaTime);
        this.render();
        
        requestAnimationFrame((time) => this.gameLoop(time));
    }

    // === 界面控制 ===
    hideAllScreens() {
        document.querySelectorAll('.ui-overlay').forEach(screen => {
            screen.classList.add('hidden');
        });
    }

    showStartScreen() {
        this.state = 'start';
        this.hideAllScreens();
        document.getElementById('startScreen').classList.remove('hidden');
    }

    showSettings() {
        // 填充当前设置
        document.getElementById('soundVolume').value = this.settings.soundVolume;
        document.getElementById('bgmEnabled').checked = this.settings.bgmEnabled;
        document.getElementById('particlesEnabled').checked = this.settings.particlesEnabled;
        document.getElementById('graphicsQuality').value = this.settings.graphicsQuality;
        
        this.hideAllScreens();
        document.getElementById('settingsScreen').classList.remove('hidden');
    }

    hideSettings() {
        document.getElementById('settingsScreen').classList.add('hidden');
        
        if (this.state === 'start') {
            document.getElementById('startScreen').classList.remove('hidden');
        } else if (this.state === 'paused') {
            document.getElementById('pauseScreen').classList.remove('hidden');
        } else {
            // 其他状态默认返回开始界面
            this.showStartScreen();
        }
    }

    saveSettings() {
        this.settings.soundVolume = parseInt(document.getElementById('soundVolume').value);
        this.settings.bgmEnabled = document.getElementById('bgmEnabled').checked;
        this.settings.particlesEnabled = document.getElementById('particlesEnabled').checked;
        this.settings.graphicsQuality = document.getElementById('graphicsQuality').value;
        
        localStorage.setItem('gameSettings', JSON.stringify(this.settings));
        
        // 应用设置
        this.sounds.setVolume(this.settings.soundVolume);
        this.sounds.setBGMEnabled(this.settings.bgmEnabled);
        this.particles.enabled = this.settings.particlesEnabled;
        
        this.hideSettings();
    }

    loadSettings() {
        const saved = localStorage.getItem('gameSettings');
        if (saved) {
            this.settings = JSON.parse(saved);
        }
    }

    // === 存档功能 ===
    saveGame() {
        const saveData = {
            player: {
                x: this.player.x,
                y: this.player.y,
                lives: this.player.lives,
                score: this.player.score,
                level: this.player.level,
                powerLevel: this.player.powerLevel,
                fireRate: this.player.fireRate
            },
            enemies: this.enemies.map(e => ({
                type: e.type,
                x: e.x,
                y: e.y,
                health: e.health,
                maxHealth: e.maxHealth
            })),
            powerUps: this.powerUps.map(p => ({
                type: p.type,
                x: p.x,
                y: p.y
            })),
            spawnRate: this.spawnRate,
            timestamp: Date.now()
        };
        
        localStorage.setItem('gameSave', JSON.stringify(saveData));
        alert('游戏已保存！');
    }

    loadGame() {
        try {
            const saved = localStorage.getItem('gameSave');
            if (!saved) {
                alert('没有找到存档！');
                return;
            }
            
            const saveData = JSON.parse(saved);
            
            this.hideAllScreens();
            this.player = new Player(this);
            
            // 恢复玩家状态
            if (saveData.player) {
                this.player.x = saveData.player.x;
                this.player.y = saveData.player.y;
                this.player.lives = saveData.player.lives;
                this.player.score = saveData.player.score;
                this.player.level = saveData.player.level;
                this.player.powerLevel = saveData.player.powerLevel;
                this.player.fireRate = saveData.player.fireRate;
            }
            
            // 恢复敌机
            this.enemies = [];
            if (saveData.enemies && Array.isArray(saveData.enemies)) {
                this.enemies = saveData.enemies.map(e => {
                    const enemy = new Enemy(this, e.type);
                    enemy.x = e.x;
                    enemy.y = e.y;
                    enemy.health = e.health;
                    enemy.maxHealth = e.maxHealth;
                    return enemy;
                });
            }
            
            // 恢复道具
            this.powerUps = [];
            if (saveData.powerUps && Array.isArray(saveData.powerUps)) {
                this.powerUps = saveData.powerUps.map(p => {
                    const powerUp = new PowerUp(this, p.x, p.y);
                    powerUp.type = p.type;
                    powerUp.color = powerUp.getColor();
                    return powerUp;
                });
            }
            
            // 恢复难度
            if (saveData.spawnRate) {
                this.spawnRate = saveData.spawnRate;
            }
            
            this.particles = new ParticleSystem(this);
            this.particles.enabled = this.settings.particlesEnabled;
            
            this.state = 'playing';
            this.sounds.init();
            if (this.settings.bgmEnabled) {
                this.sounds.startBGM();
            }
            
            this.updateHUD();
            this.gameLoop();
            
            alert('游戏已加载！');
        } catch (error) {
            console.error('加载存档失败:', error);
            alert('存档文件损坏或格式错误！');
        }
    }
}

// 初始化游戏
const game = new Game();

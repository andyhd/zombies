(function () {

    var canvas = document.getElementById('canvas');
    canvas.width = 576;
    canvas.height = 480;
    var ctx = canvas.getContext('2d');

    var key = { up: 38, down: 40, left: 37, right: 39, a: 65, s: 83, d: 68, w: 87 };
    var hold = { up: 0, down: 0, left: 0, right: 0, a: 0, s: 0, d: 0, w: 0 };

    function or(a, b) { return a | b }
    function xor(a, b) { return a ^ b }

    function testKeys(op) {
        return function (e) {
            for (var k in key) {
                hold[k] = op(hold[k], e.keyCode == key[k]);
            }
            return false;
        };
    }

    function addListener(el, name, fn) {
        if (el.attachEvent) {
            el.attachEvent('on' + name, function () { fn.call(el) });
        } else if (el.addEventListener) {
            el.addEventListener(name, fn, false);
        }
    }

    addListener(window, 'keydown', testKeys(or));
    addListener(window, 'keyup', testKeys(xor));

    function clear() {
        ctx.fillStyle = 'rgb(0,0,0)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    var player = { x: 256, y: 192, w: 32, h: 32 }
    var bullets = [];
    var baddies = [];
    var particles = [];
    var health = 10;
    var maxHealth = 10;
    var score = 0;

    function drawPlayer() {
        ctx.fillStyle = 'rgb(255, 255, 255)';
        ctx.fillRect(player.x, player.y, player.w, player.h);
    }

    function sgn(x) {
        return (x > 0) - (x < 0);
    }

    function explosion(p) {
        for (var i = 0; i < 30; i++) {
            particles[particles.length] = {
                x: p.x + p.w / 2, y: p.y + p.h / 2,
                w: 5, h: 5, a: 1,
                vx: (Math.random() - .5) * 10,
                vy: (Math.random() - .5) * 10
            };
        }
    }

    function update(mobs, moveFn, collideFn, drawFn) {
        var p;
        for (particle in mobs) {
            p = mobs[particle];
            moveFn(p);
            if (collideFn && collideFn(p, mobs, particle)) {
                continue;
            }
            drawFn(p);
        }
    }

    function moveTowardPlayer(b) {
        var distFromPlayer = Math.sqrt(Math.pow(player.x - b.x, 2) +
                                       Math.pow(player.y - b.y, 2));
        var sine = Math.sin(distFromPlayer / 3);
        var vel = 0.1 + (1 + sine) * 0.3;
        var yadj = Math.abs(player.y - b.y) / distFromPlayer;
        var xadj = Math.abs(player.x - b.x) / distFromPlayer;
        var vector = [sgn(player.x - b.x) * vel * xadj , sgn(player.y - b.y) * vel * yadj];
        move(b, vector);
    }

    function intersect(a, b) {
        return a.x < b.x + b.w && a.x + a.w >= b.x &&
            a.y < b.y + b.h && a.y + a.h >= b.y;
    }

    function collideWithPlayer(b, mobs, index) {
        if (health > 0 && intersect(b, player)) {
            mobs.splice(index, 1);
            explosion(b);
            health--;
            return true;
        }
        return false;
    }

    function drawBaddie(b) {
        ctx.fillStyle = 'rgb(0, 0, 255)';
        b.frame = ++b.frame % 60;
        var frame = Math.floor(b.frame / 15) % 4;
        var sx = frame * 32;
        if (frame == 3) sx = 32;
        ctx.drawImage(b.sprite, sx, 0, b.w, b.h, b.x, b.y, b.w, b.h);
    }

    function updateBaddies() {
        update(baddies, moveTowardPlayer, collideWithPlayer, drawBaddie);
    }

    function removeIfOffscreen(p, mobs, index) {
        if (p.x < 0 || p.x > canvas.width || p.y < 0 || p.y > canvas.height) {
            mobs.splice(index, 1);
            return true;
        }
        return false;
    }

    function collideWithBaddies(b, mobs, index) {
        var z;
        for (baddie in baddies) {
            z = baddies[baddie];
            if (intersect(b, z)) {
                mobs.splice(index, 1);
                baddies.splice(baddie, 1);
                explosion(z);
                score++;
                return true;
            }
        }
        return false;
    }

    function drawBullet(b) {
        ctx.fillStyle = 'rgb(255, 255, 255)';
        ctx.fillRect(b.x, b.y, b.w, b.h);
    }

    function updateBullets() {
        update(bullets,
            moveParticle,
            function (b, mobs, i) {
                return collideWithBaddies(b, mobs, i) ||
                       removeIfOffscreen(b, mobs, i)
            },
            drawBullet
        );
    }

    function moveParticle(p) {
        move(p, [p.vx, p.vy]);
    }

    function drawParticle(p) {
        p.a *= 0.98;
        if (p.a < 0.2) p.a = 0;
        ctx.fillStyle = 'rgba(255, 0, 0, ' + p.a + ')';
        ctx.fillRect(p.x, p.y, p.w, p.h);
    }

    function updateParticles() {
        update(particles, moveParticle, removeIfOffscreen, drawParticle);
    }

    function move(mob, vector) {
        mob.x += vector[0];
        mob.y += vector[1];
    }

    var lastBullet = 0;

    function fire(mob, vector) {
        if (lastBullet++ > 4 && bullets.length < 20) {
            bullets[bullets.length] = {
                x: mob.x + 14,
                y: mob.y + 14,
                w: 5,
                h: 5,
                vx: vector[0] * 8,
                vy: vector[1] * 8
            };
            lastBullet = 0;
        }
    }

    function checkControls() {
        move(player, [(hold.right - hold.left) * 5, (hold.down - hold.up) * 5]);
        if ((hold.a ^ hold.d) | (hold.s ^ hold.w)) {
            fire(player, [(hold.d - hold.a), (hold.s - hold.w)]);
        }
    }

    function addBaddie() {
        if (baddies.length > 100) {
            baddies.slice(0, 1);
        }
        var bx = Math.floor(Math.random() * canvas.width);
        var by = Math.floor(Math.random() * canvas.height);
        var r = Math.random();
        if (r < .25) {
            bx = 0;
        } else if (r < .5) {
            bx = canvas.width - 32;
        } else if (r < .75) {
            by = 0;
        } else {
            by = canvas.height - 32;
        }
        baddies[baddies.length] = {
            x: bx, y: by,
            w: 32, h: 32,
            vx: 0, vy: 0,
            sprite: zombieSprites[Math.floor(Math.random() * 5)],
            frame: 0
        };
    }

    function drawHud() {
        ctx.fillStyle = 'rgb(255, 255, 255)';
        ctx.fillText("Score: " + score, 20, 20);
        for (var h = 0; h < maxHealth; h++) {
            if (h >= health) {
                ctx.fillStyle = 'rgb(255, 0, 0)';
            }
            ctx.fillRect(20 + h * 6, canvas.height - 40, 4, 20);
        }
    }

    function gameOver() {
        ctx.fillStyle = 'rgb(255, 255, 255)';
        ctx.fillText('G A M E   O V E R', canvas.width / 2 - 55, canvas.height / 2);
    }

    var reqAnimFrame = (function () {
        return window.requestAnimationFrame ||
            window.webkitRequestAnimationFrame ||
            window.mozRequestAnimationFrame ||
            function (callback) {
                window.setTimeout(callback, 1000 / 60);
            };
    })();

    function animLoop() {
        reqAnimFrame(animLoop);
        clear();
        if (health > 0) {
            checkControls();
            drawPlayer();
        }
        updateBullets();
        if (Math.random() > .99) {
            addBaddie();
        }
        updateBaddies();
        updateParticles();
        drawHud();
        if (health < 1) {
            gameOver();
        }
    }

    var zombieSprites = [];
    (function () {
        var sprite = [];
        var loaded = 0;
        var src = ['MzombieA.png', 'MzombieB.png',
                   'MzombieC.png', 'MzombieD.png', 'Zomtemplate.png'];
        for (var i = 0; i < src.length; i++) {
            sprite[i] = new Image();
            sprite[i].onload = function () {
                loaded++;
                if (loaded == src.length) {
                    zombieSprites = sprite;
                    animLoop();
                }
            };
            sprite[i].src = src[i];
        }
    })();

})();

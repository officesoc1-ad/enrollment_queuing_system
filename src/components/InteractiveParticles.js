'use client';

import { useEffect, useRef } from 'react';

export default function InteractiveParticles() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    let animationFrameId;
    let foxes = [];
    let mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
    let mouseX = 0;
    let mouseY = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = canvas.parentElement.clientHeight || window.innerHeight;
      initFoxes();
    };

    window.addEventListener('resize', resize);
    
    const handleMouseMove = (e) => {
      // Track mouse globally for parallax
      mouse.targetX = e.clientX - window.innerWidth / 2;
      mouse.targetY = e.clientY - window.innerHeight / 2;
    };

    window.addEventListener('mousemove', handleMouseMove);

    class Fox {
      constructor() {
        this.reset(true);
      }
      
      reset(randomizeHeight = false) {
        // Distribute far beyond canvas edges for seamless parallax
        this.x = Math.random() * canvas.width * 1.5 - canvas.width * 0.25;
        this.y = randomizeHeight 
          ? Math.random() * canvas.height * 1.5 - canvas.height * 0.25 
          // If respawning, start from bottom
          : canvas.height + 50 + Math.random() * 100;
          
        this.baseX = this.x;
        this.baseY = this.y;
        
        this.z = Math.random() * 1.5 + 0.5; // Depth
        this.size = Math.random() * 20 + 10 * this.z; // Fox emoji size
        
        // Drifting speeds
        this.speedY = -(Math.random() * 0.5 + 0.2) * this.z;
        
        // Swaying
        this.swaySpeed = Math.random() * 0.02 + 0.01;
        this.swayAmount = Math.random() * 30 + 10;
        this.angle = Math.random() * Math.PI * 2;
        
        // Rotation
        this.rotSpeed = (Math.random() - 0.5) * 0.02;
        this.rotation = Math.random() * Math.PI * 2;
      }

      draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        ctx.font = `${this.size}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Render ghosting opacity based on depth
        ctx.globalAlpha = Math.min(this.z * 0.5 + 0.1, 1);
        ctx.fillText("🦊", 0, 0);
        
        ctx.restore();
      }

      update() {
        this.angle += this.swaySpeed;
        this.rotation += this.rotSpeed;
        
        // Keep drifting 
        this.baseY += this.speedY;
        this.baseX += Math.sin(this.angle) * 0.5;
        
        // Reset if drifted off screen top
        if (this.baseY < -100) {
            this.reset(false);
        }
        
        // Parallax effect
        let parallaxX = mouseX * this.z * 0.05;
        let parallaxY = mouseY * this.z * 0.05;
        
        this.x = this.baseX - parallaxX;
        this.y = this.baseY - parallaxY;
      }
    }

    const initFoxes = () => {
      foxes = [];
      const foxCount = Math.floor((canvas.width * canvas.height) / 15000); 
      for (let i = 0; i < foxCount; i++) {
        foxes.push(new Fox());
      }
    };

    const animate = () => {
      mouseX += (mouse.targetX - mouseX) * 0.05;
      mouseY += (mouse.targetY - mouseY) * 0.05;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      for (let i = 0; i < foxes.length; i++) {
        foxes[i].update();
        foxes[i].draw();
      }
      
      animationFrameId = requestAnimationFrame(animate);
    };

    resize();
    animate();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0
      }}
    />
  );
}

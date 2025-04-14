
import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '1rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			fontFamily: {
				sans: ['Poppins', 'sans-serif'],
				casino: ['Playfair Display', 'serif'],
				mono: ['Roboto Mono', 'monospace'],
			},
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				vegas: {
					black: '#0A0C14',
					darkgray: '#161A26',
					green: '#00ff00',
					gold: '#FFFFFF',        // Changed from D4AF37 to white
					darkgold: '#E0E0E0',    // Changed to light gray
					blue: '#36B5FF',
					red: '#FF4560',
					darkgreen: '#0E3B28',
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				}
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				'accordion-down': {
					from: { height: '0' },
					to: { height: 'var(--radix-accordion-content-height)' }
				},
				'accordion-up': {
					from: { height: 'var(--radix-accordion-content-height)' },
					to: { height: '0' }
				},
				'fade-in': {
					'0%': { opacity: '0', transform: 'translateY(10px)' },
					'100%': { opacity: '1', transform: 'translateY(0)' }
				},
				'pulse-neon': {
					'0%, 100%': { boxShadow: '0 0 10px 0 rgba(59, 255, 161, 0.15)' },
					'50%': { boxShadow: '0 0 20px 5px rgba(59, 255, 161, 0.25)' }
				},
				'pulse-gold': {
					'0%, 100%': { boxShadow: '0 0 10px 0 rgba(255, 255, 255, 0.5)' },  // Changed to white
					'50%': { boxShadow: '0 0 20px 5px rgba(255, 255, 255, 0.7)' }      // Changed to white
				},
				'shine-gold': {
					'0%': { backgroundPosition: '0% 50%' },
					'50%': { backgroundPosition: '100% 50%' },
					'100%': { backgroundPosition: '0% 50%' }
				},
				'pulse-blue': {
					'0%, 100%': { boxShadow: '0 0 10px 0 rgba(54, 181, 255, 0.7)' },
					'50%': { boxShadow: '0 0 20px 5px rgba(54, 181, 255, 0.9)' }
				},
				'float': {
					'0%, 100%': { transform: 'translateY(0)' },
					'50%': { transform: 'translateY(-5px)' }
				},
				'scale-in': {
					'0%': { transform: 'scale(0.95)', opacity: '0' },
					'100%': { transform: 'scale(1)', opacity: '1' }
				},
				'bell-shake': {
					'0%, 100%': { transform: 'rotate(0)' },
					'20%, 80%': { transform: 'rotate(15deg)' },
					'40%, 60%': { transform: 'rotate(-15deg)' }
				},
				'confetti': {
					'0%': { transform: 'translateY(0) rotate(0)', opacity: '1', scale: '0' },
					'100%': { transform: 'translateY(-500px) rotate(720deg)', opacity: '0', scale: '1' }
				},
				'slide-up': {
					'0%': { transform: 'translateY(20px)', opacity: '0' },
					'100%': { transform: 'translateY(0)', opacity: '1' }
				},
				'slide-left': {
					'0%': { transform: 'translateX(20px)', opacity: '0' },
					'100%': { transform: 'translateX(0)', opacity: '1' }
				},
				'slide-right': {
					'0%': { transform: 'translateX(-20px)', opacity: '0' },
					'100%': { transform: 'translateX(0)', opacity: '1' }
				},
				'ticker': {
					'0%': { transform: 'translateX(100%)' },
					'100%': { transform: 'translateX(-100%)' }
				},
				'spin-slow': {
					'0%': { transform: 'rotate(0deg)' },
					'100%': { transform: 'rotate(360deg)' }
				},
				'flicker': {
					'0%, 100%': { opacity: '1' },
					'50%': { opacity: '0.5' }
				},
				'jackpot-lights': {
					'0%': { boxShadow: '0 0 5px rgba(255, 255, 255, 0.7), 0 0 10px rgba(255, 255, 255, 0.5), 0 0 15px rgba(255, 255, 255, 0.3)' },  // Changed to white
					'33%': { boxShadow: '0 0 5px rgba(255, 69, 96, 0.7), 0 0 10px rgba(255, 69, 96, 0.5), 0 0 15px rgba(255, 69, 96, 0.3)' },
					'66%': { boxShadow: '0 0 5px rgba(54, 181, 255, 0.7), 0 0 10px rgba(54, 181, 255, 0.5), 0 0 15px rgba(54, 181, 255, 0.3)' },
					'100%': { boxShadow: '0 0 5px rgba(255, 255, 255, 0.7), 0 0 10px rgba(255, 255, 255, 0.5), 0 0 15px rgba(255, 255, 255, 0.3)' }  // Changed to white
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'fade-in': 'fade-in 0.4s ease-out',
				'pulse-neon': 'pulse-neon 2s infinite',
				'pulse-gold': 'pulse-gold 2s infinite',
				'shine-gold': 'shine-gold 3s linear infinite',
				'pulse-blue': 'pulse-blue 2s infinite',
				'float': 'float 3s ease-in-out infinite',
				'scale-in': 'scale-in 0.2s ease-out',
				'bell-shake': 'bell-shake 0.5s ease-in-out',
				'confetti': 'confetti 1s ease-in-out forwards',
				'slide-up': 'slide-up 0.5s ease-out',
				'slide-left': 'slide-left 0.5s ease-out',
				'slide-right': 'slide-right 0.5s ease-out',
				'ticker': 'ticker 15s linear infinite',
				'spin-slow': 'spin-slow 10s linear infinite',
				'flicker': 'flicker 0.5s linear infinite',
				'jackpot-lights': 'jackpot-lights 5s linear infinite'
			},
			backgroundImage: {
				'gold-gradient': 'linear-gradient(135deg, #FFFFFF 0%, #F0F0F0 50%, #FFFFFF 100%)',  // Changed from gold to white/gray
				'dark-gradient': 'linear-gradient(135deg, #0A0C14 0%, #161A26 100%)',
				'table-felt': 'linear-gradient(135deg, #0E3B28 0%, #0D2F20 100%)'
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;

import React, { useState, useEffect, useRef } from 'react';
import { Camera, X } from 'lucide-react';

const BarcodeScanner = ({ onScanDetected }) => {
    const videoRef = useRef(null);
    const [isScanning, setIsScanning] = useState(false);
    const [status, setStatus] = useState('Ready to scan');
    const readerRef = useRef(null);

    useEffect(() => {
        let reader = null;

        const initializeScanner = async () => {
            try {
                setIsScanning(true);
                setStatus('Loading camera...');
                
                // Import ZXing library
                const { BrowserMultiFormatReader } = await import('@zxing/library');
                reader = new BrowserMultiFormatReader();
                readerRef.current = reader;
                
                // Get available cameras
                const devices = await reader.getVideoInputDevices();
                console.log('📹 Cameras found:', devices.length);
                
                if (devices.length === 0) {
                    throw new Error('No camera devices found');
                }
                
                // Use first available camera
                const deviceId = devices[0]?.deviceId;
                console.log('📹 Using camera:', deviceId);

                if (!videoRef.current) {
                    console.error('❌ Video element not found');
                    return;
                }

                setStatus('Scanning for barcodes...');
                console.log('🔍 Starting barcode detection...');
                
                // Start continuous scanning
                await reader.decodeFromVideoDevice(deviceId, videoRef.current, (result, err) => {
                    if (result && result.getText()) {
                        const code = String(result.getText()).trim();
                        console.log('🎯 BARCODE DETECTED:', code);
                        
                        // Basic validation - must be at least 8 digits
                        if (code.length >= 8) {
                            setStatus(`Scanned: ${code}`);
                            setIsScanning(false);
                            
                            // Stop scanning temporarily
                            try { 
                                reader?.reset(); 
                            } catch (resetError) { 
                                console.warn('Scanner reset error:', resetError);
                            }
                            
                            // Call the scan handler
                            console.log('📤 Calling onScanDetected with:', code);
                            onScanDetected(code);
                            
                            // Reset after 3 seconds
                            setTimeout(() => {
                                setStatus('Scanning...');
                                setIsScanning(true);
                            }, 3000);
                        } else {
                            console.log('❌ Barcode too short:', code);
                        }
                    } else if (err && err.name !== 'NotFoundException') {
                        console.warn('⚠️ Scanner warning:', err.message);
                    }
                });
                
                console.log('✅ Scanner initialized successfully');
                setStatus('Ready - Point camera at barcode');
                
            } catch (e) {
                console.error('❌ Scanner initialization failed:', e);
                setStatus(`Error: ${e.message}`);
                setIsScanning(false);
            }
        };

        // Small delay to ensure component is mounted
        setTimeout(initializeScanner, 500);
        
        return () => { 
            console.log('🧹 Cleaning up scanner...');
            try { 
                readerRef.current?.reset(); 
            } catch (_) {} 
            if (videoRef.current?.srcObject) {
                videoRef.current.srcObject.getTracks().forEach(t => t.stop());
            }
        };
    }, [onScanDetected]);

    return (
        <div className="space-y-4">
            <div className="relative rounded-2xl overflow-hidden bg-black border-2 border-slate-800 shadow-2xl aspect-[4/3] max-h-80">
                <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className="absolute inset-0 w-full h-full object-cover" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/70 pointer-events-none" />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <div className="w-56 h-32 border-2 border-emerald-400/90 rounded-xl flex items-center justify-center overflow-hidden bg-black/20">
                        <div className="w-full h-1 bg-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.9)] animate-[scanline_2s_ease-in-out_infinite]" />
                    </div>
                    <p className="mt-4 text-white font-medium text-sm tracking-wider">
                        {isScanning ? '📷 Point camera at barcode' : '⏸️ Scanner paused'}
                    </p>
                </div>
                <style>{`
                    @keyframes scanline { 
                        0%, 100% { transform: translateY(-100px); opacity: 0.5; } 
                        50% { transform: translateY(100px); opacity: 1; } 
                    }
                `}</style>
            </div>
            
            <div className="bg-white rounded-xl p-4 border border-slate-200">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-bold text-slate-800">Scanner Status</h3>
                    <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                        status.includes('Scanned') ? 'bg-green-100 text-green-800' :
                        status.includes('Error') ? 'bg-red-100 text-red-800' :
                        'bg-blue-100 text-blue-800'
                    }`}>
                        {status}
                    </div>
                </div>
                
                {status.includes('Error') && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <p className="text-amber-700 text-sm">
                            ⚠️ {status}
                        </p>
                        <p className="text-amber-600 text-xs mt-2">
                            💡 Try refreshing the page or checking camera permissions
                        </p>
                    </div>
                )}
                
                {isScanning && !status.includes('Error') && (
                    <p className="text-emerald-600 text-sm text-center font-medium">
                        📷 Scanner active - Align barcode in frame
                    </p>
                )}
            </div>
        </div>
    );
};

export default BarcodeScanner;

import React, { useState, useEffect, useRef } from 'react';

const SimpleScanner = ({ onScan }) => {
    const videoRef = useRef(null);
    const fileInputRef = useRef(null);
    const [status, setStatus] = useState('Ready');
    const [isScanning, setIsScanning] = useState(false);
    const [scanMode, setScanMode] = useState('camera');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [error, setError] = useState('');

    // OpenFoodFacts API integration
    const lookupOpenFoodFacts = async (barcode) => {
        try {
            const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`);
            if (response.ok) {
                const data = await response.json();
                if (data.status === 1) {
                    const product = data.product;
                    return {
                        name: product.product_name || 'Unknown Product',
                        brand: product.brands || 'Unknown Brand',
                        description: product.generic_name || '',
                        netWeight: product.quantity || '',
                        servingSize: product.serving_size || '',
                        ingredients: product.ingredients_text ? [product.ingredients_text] : [],
                        nutritionFacts: product.nutriments || {},
                        images: product.image_front_url ? [product.image_front_url] : [],
                        confidence: 95,
                        source: 'OpenFoodFacts',
                        category: product.categories || 'General',
                        price: null
                    };
                }
            }
        } catch (error) {
            console.log('OpenFoodFacts lookup failed');
        }
        return null;
    };

    // Process barcode
    const processBarcode = async (barcode) => {
        setStatus('Looking up product...');

        try {
            const openFoodData = await lookupOpenFoodFacts(barcode);
            if (openFoodData) {
                setStatus(`Found: ${openFoodData.name}`);
                onScan(barcode, openFoodData);
                return;
            }

            setStatus('Product not found');
            const fallbackData = {
                name: 'Product Not Found',
                brand: 'Unknown',
                description: 'Product not found in database',
                netWeight: '',
                servingSize: '',
                ingredients: [],
                nutritionFacts: {},
                images: [],
                confidence: 0,
                source: 'Not Found',
                category: 'General',
                price: null
            };
            onScan(barcode, fallbackData);
        } catch (error) {
            setError('Failed to lookup barcode');
            setStatus('Error');
        }
    };

    // Handle image upload
    const handleImageUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setIsAnalyzing(true);
        setStatus('Analyzing...');

        setTimeout(() => {
            const mockBarcode = '0123456789012';
            processBarcode(mockBarcode);
            setIsAnalyzing(false);
        }, 2000);
    };

    // Camera setup - fixed for blank screen issue
    useEffect(() => {
        if (scanMode !== 'camera') return;

        let reader = null;
        let lastScanTime = 0;
        let isProcessing = false;
        const videoElement = videoRef.current;

        const startCamera = async () => {
            try {
                console.log('🎥 Starting camera...');
                setStatus('🎥 Starting camera...');

                const { BrowserMultiFormatReader } = await import('@zxing/library');
                reader = new BrowserMultiFormatReader();

                const devices = await reader.getVideoInputDevices();
                console.log('📱 Available devices:', devices);

                if (devices.length === 0) {
                    setError('No camera found');
                    setStatus('❌ No camera found');
                    return;
                }

                // Mobile camera selection - prioritize back camera
                let deviceId = devices[0]?.deviceId;

                // Prioritize back/rear cameras if available (regardless of platform, as modern laptops also have world-facing cameras)
                const backCamera = devices.find(d =>
                    /back|rear|environment|world/i.test(d.label)
                );

                if (backCamera) {
                    deviceId = backCamera.deviceId;
                    console.log('📱 Using back camera:', backCamera.label);
                } else {
                    // Try to guess by index if labels are missing/generic (common on mobile browsers)
                    if (devices.length > 1) {
                        deviceId = devices[1].deviceId; // Often device 1 is back camera if 0 is front
                        console.log('📱 Using secondary camera fallback:', devices[1].label || 'Unknown label');
                    } else {
                        console.log('📱 Using primary/only camera:', devices[0]?.label || 'Unknown label');
                    }
                }

                // Start video stream first
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: "environment", // explicitly request environment
                        deviceId: deviceId ? { exact: deviceId } : undefined
                    }
                });

                if (videoElement) {
                    videoElement.srcObject = stream;
                    await videoElement.play();
                    console.log('✅ Video stream started');
                }

                // Then start barcode scanning
                await reader.decodeFromVideoDevice(deviceId, videoElement, (result, err) => {
                    if (result && !isProcessing) {
                        const code = result.getText();
                        const now = Date.now();

                        // Prevent duplicate scans - wait at least 1 second between scans
                        if (code && code.length >= 8 && (now - lastScanTime) > 1000) {
                            lastScanTime = now;
                            isProcessing = true;
                            setIsScanning(true);
                            setStatus(`✅ Scanned: ${code}`);

                            // Process barcode and auto-reset
                            processBarcode(code);

                            // Auto-reset for next scan after 1.5 seconds
                            setTimeout(() => {
                                isProcessing = false;
                                setIsScanning(false);
                                setStatus('📷 Ready for next scan');
                            }, 1500);
                        }
                    }
                });

                setStatus('📷 Ready to scan - Point at barcode');
                console.log('✅ Scanner ready');
            } catch (error) {
                console.error('❌ Camera error:', error);
                setError('Camera error - Please allow camera permissions');
                setStatus('❌ Camera access denied');
            }
        };

        startCamera();

        return () => {
            if (reader) {
                reader.reset();
                console.log('🔄 Scanner reset');
            }
            if (videoElement?.srcObject) {
                videoElement.srcObject.getTracks().forEach(track => track.stop());
                console.log('🛑 Camera stopped');
            }
        };
    }, [scanMode]);

    return (
        <div style={{ padding: '20px', maxWidth: '500px', margin: '0 auto' }}>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <button
                    onClick={() => setScanMode('camera')}
                    style={{
                        flex: 1,
                        padding: '12px',
                        backgroundColor: scanMode === 'camera' ? '#1B5E20' : '#f3f4f6',
                        color: scanMode === 'camera' ? 'white' : '#374151',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 'bold'
                    }}
                >
                    📷 Camera
                </button>
                <button
                    onClick={() => setScanMode('image')}
                    style={{
                        flex: 1,
                        padding: '12px',
                        backgroundColor: scanMode === 'image' ? '#1B5E20' : '#f3f4f6',
                        color: scanMode === 'image' ? 'white' : '#374151',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 'bold'
                    }}
                >
                    📷 Upload
                </button>
            </div>

            {/* Camera Mode */}
            {scanMode === 'camera' && (
                <div>
                    <video
                        ref={videoRef}
                        style={{
                            width: '100%',
                            height: '250px',
                            objectFit: 'cover',
                            borderRadius: '12px',
                            backgroundColor: '#000',
                            border: '2px solid #1B5E20'
                        }}
                        autoPlay
                        playsInline
                        muted
                    />

                    <div style={{
                        marginTop: '15px',
                        padding: '15px',
                        backgroundColor: '#f0fdf4',
                        border: '1px solid #86efac',
                        borderRadius: '8px',
                        textAlign: 'center'
                    }}>
                        <div style={{
                            fontSize: '16px',
                            fontWeight: 'bold',
                            color: '#166534',
                            marginBottom: '8px'
                        }}>
                            {status}
                        </div>

                        {isScanning && (
                            <div style={{
                                display: 'inline-block',
                                padding: '4px 12px',
                                backgroundColor: '#fbbf24',
                                color: '#78350f',
                                borderRadius: '12px',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                marginTop: '8px'
                            }}>
                                Processing...
                            </div>
                        )}
                    </div>

                    {/* Manual Reset Button */}
                    <button
                        onClick={() => {
                            setIsScanning(false);
                            setStatus('📷 Ready for next scan');
                            setError('');
                        }}
                        style={{
                            width: '100%',
                            padding: '12px',
                            backgroundColor: '#6b7280',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            marginTop: '10px'
                        }}
                    >
                        🔄 Reset Scanner
                    </button>
                </div>
            )}

            {/* Upload Mode */}
            {scanMode === 'image' && (
                <div style={{
                    padding: '20px',
                    backgroundColor: '#f9fafb',
                    border: '2px dashed #d1d5db',
                    borderRadius: '12px',
                    textAlign: 'center'
                }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>📷</div>
                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937', marginBottom: '8px' }}>
                        Upload Image
                    </h3>
                    <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '20px' }}>
                        Take a photo or upload an image with a barcode
                    </p>

                    <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        style={{ display: 'none' }}
                        id="image-upload"
                    />

                    <label
                        htmlFor="image-upload"
                        style={{
                            display: 'inline-block',
                            padding: '12px 24px',
                            backgroundColor: isAnalyzing ? '#9ca3af' : '#1B5E20',
                            color: 'white',
                            borderRadius: '8px',
                            cursor: isAnalyzing ? 'not-allowed' : 'pointer',
                            fontSize: '14px',
                            fontWeight: 'bold'
                        }}
                    >
                        {isAnalyzing ? 'Analyzing...' : 'Choose Image'}
                    </label>
                </div>
            )}

            {error && (
                <div style={{
                    marginTop: '15px',
                    padding: '12px',
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '8px',
                    color: '#dc2626',
                    fontSize: '14px',
                    fontWeight: 'bold'
                }}>
                    ⚠️ {error}
                </div>
            )}
        </div>
    );
};

export default SimpleScanner;

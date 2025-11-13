import { useState, useEffect, useCallback } from 'react';

export interface UseVideoDevicesReturn {
  cameras: MediaDeviceInfo[];
  microphones: MediaDeviceInfo[];
  speakers: MediaDeviceInfo[];
  
  selectedCamera: string | null;
  selectedMicrophone: string | null;
  selectedSpeaker: string | null;
  
  selectCamera: (deviceId: string) => void;
  selectMicrophone: (deviceId: string) => void;
  selectSpeaker: (deviceId: string) => void;
  
  refreshDevices: () => Promise<void>;
  
  hasPermissions: boolean;
  requestPermissions: () => Promise<boolean>;
}

const STORAGE_KEYS = {
  CAMERA: 'agora_selected_camera',
  MICROPHONE: 'agora_selected_microphone',
  SPEAKER: 'agora_selected_speaker',
};

export const useVideoDevices = (): UseVideoDevicesReturn => {
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [speakers, setSpeakers] = useState<MediaDeviceInfo[]>([]);
  
  const [selectedCamera, setSelectedCamera] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEYS.CAMERA)
  );
  const [selectedMicrophone, setSelectedMicrophone] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEYS.MICROPHONE)
  );
  const [selectedSpeaker, setSelectedSpeaker] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEYS.SPEAKER)
  );
  
  const [hasPermissions, setHasPermissions] = useState(false);

  // Enumerate devices
  const enumerateDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      const videoInputs = devices.filter(d => d.kind === 'videoinput');
      const audioInputs = devices.filter(d => d.kind === 'audioinput');
      const audioOutputs = devices.filter(d => d.kind === 'audiooutput');
      
      console.log('[useVideoDevices] Devices enumerated:', {
        cameras: videoInputs.length,
        microphones: audioInputs.length,
        speakers: audioOutputs.length,
      });
      
      setCameras(videoInputs);
      setMicrophones(audioInputs);
      setSpeakers(audioOutputs);

      // Set defaults if not already set
      if (!selectedCamera && videoInputs.length > 0) {
        setSelectedCamera(videoInputs[0].deviceId);
      }
      if (!selectedMicrophone && audioInputs.length > 0) {
        setSelectedMicrophone(audioInputs[0].deviceId);
      }
      if (!selectedSpeaker && audioOutputs.length > 0) {
        setSelectedSpeaker(audioOutputs[0].deviceId);
      }

      setHasPermissions(true);
    } catch (error) {
      console.error('[useVideoDevices] Error enumerating devices:', error);
      setHasPermissions(false);
    }
  }, [selectedCamera, selectedMicrophone, selectedSpeaker]);

  // Request permissions
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    try {
      console.log('[useVideoDevices] Requesting permissions');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: true 
      });
      
      // Stop all tracks immediately - we just needed permissions
      stream.getTracks().forEach(track => track.stop());
      
      // Now enumerate devices
      await enumerateDevices();
      
      console.log('[useVideoDevices] Permissions granted');
      return true;
    } catch (error) {
      console.error('[useVideoDevices] Permission denied:', error);
      setHasPermissions(false);
      return false;
    }
  }, [enumerateDevices]);

  // Refresh devices
  const refreshDevices = useCallback(async () => {
    console.log('[useVideoDevices] Refreshing devices');
    await enumerateDevices();
  }, [enumerateDevices]);

  // Select camera
  const selectCamera = useCallback((deviceId: string) => {
    console.log('[useVideoDevices] Selecting camera:', deviceId);
    setSelectedCamera(deviceId);
    localStorage.setItem(STORAGE_KEYS.CAMERA, deviceId);
  }, []);

  // Select microphone
  const selectMicrophone = useCallback((deviceId: string) => {
    console.log('[useVideoDevices] Selecting microphone:', deviceId);
    setSelectedMicrophone(deviceId);
    localStorage.setItem(STORAGE_KEYS.MICROPHONE, deviceId);
  }, []);

  // Select speaker
  const selectSpeaker = useCallback((deviceId: string) => {
    console.log('[useVideoDevices] Selecting speaker:', deviceId);
    setSelectedSpeaker(deviceId);
    localStorage.setItem(STORAGE_KEYS.SPEAKER, deviceId);
  }, []);

  // Listen for device changes
  useEffect(() => {
    const handleDeviceChange = () => {
      console.log('[useVideoDevices] Device change detected');
      enumerateDevices();
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);

    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [enumerateDevices]);

  // Initial enumeration (if permissions already granted)
  useEffect(() => {
    enumerateDevices();
  }, []);

  return {
    cameras,
    microphones,
    speakers,
    selectedCamera,
    selectedMicrophone,
    selectedSpeaker,
    selectCamera,
    selectMicrophone,
    selectSpeaker,
    refreshDevices,
    hasPermissions,
    requestPermissions,
  };
};

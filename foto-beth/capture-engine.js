/** Browser-local camera capture. No stream or photograph leaves this device. */

import { drawPhotoFrame } from './photo-frame.js';
export { photoFilterCSS } from './photo-frame.js';

const VIDEO_PREFERENCES = { width: { ideal: 1920 }, height: { ideal: 1080 } };

function cameraError(name, message) {
  const error = new Error(message);
  error.name = name;
  return error;
}

function cancelled() {
  return cameraError('AbortError', 'The camera request was cancelled.');
}

function stopTracks(stream) {
  stream?.getTracks().forEach((track) => track.stop());
}

/** Useful browser-specific errors without leaking raw device information. */
export function cameraErrorMessage(error) {
  if (error?.cameraMessage) return error.cameraMessage;
  switch (error?.name) {
    case 'InsecureContextError':
      return 'Camera access needs a secure connection. Open the HTTPS studio link in your browser.';
    case 'CameraPolicyError':
      return 'This embedded view blocks camera access. Open the studio in its own browser tab, then enable the camera.';
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return 'Camera permission was blocked. Allow camera access in your browser’s site settings, check your device’s camera permissions, then try again.';
    case 'SecurityError':
      return 'Your browser or device settings block camera access. Open the studio in a browser tab and allow the camera in site settings.';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No camera was found. Connect or enable a camera, then try again.';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'The camera is unavailable. Close any other app using it, check your device’s camera access settings, then try again.';
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return 'That camera is not available on this device. Try another camera or reconnect it.';
    case 'OnlyOneCameraError':
      return 'This device has one available camera. You can keep shooting with it.';
    case 'CameraUnavailableError':
      return 'This browser cannot access a camera. Open the studio in a recent version of Safari, Chrome, Edge, or Firefox.';
    case 'CameraNotReadyError':
      return 'The camera has not delivered a frame yet. Wait a moment, or turn it off and enable it again.';
    case 'CameraInactiveError':
      return 'Enable the camera before taking a photo.';
    case 'CaptureFailedError':
      return 'The photo could not be saved. Please try the shutter again.';
    case 'AbortError':
      return 'The camera request was cancelled. Try enabling the camera again.';
    default:
      return 'The camera could not start. Check camera permissions and try again.';
  }
}

function assertCameraAvailable() {
  if (!globalThis.isSecureContext) throw cameraError('InsecureContextError', 'HTTPS is required.');
  const policy = document.permissionsPolicy || document.featurePolicy;
  if (policy?.allowsFeature && !policy.allowsFeature('camera')) {
    throw cameraError('CameraPolicyError', 'The containing page blocks camera access.');
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw cameraError('CameraUnavailableError', 'getUserMedia is unavailable.');
  }
}

function waitForVideoFrame(video, signal) {
  return new Promise((resolve, reject) => {
    let timer;
    const events = ['loadedmetadata', 'loadeddata', 'canplay', 'playing', 'resize'];
    const cleanup = () => {
      clearTimeout(timer);
      events.forEach((type) => video.removeEventListener(type, check));
      video.removeEventListener('error', failed);
      signal.removeEventListener('abort', aborted);
    };
    const check = () => {
      if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
        cleanup();
        resolve();
      }
    };
    const failed = () => {
      cleanup();
      reject(cameraError('CameraNotReadyError', 'The video stream could not be played.'));
    };
    const aborted = () => { cleanup(); reject(cancelled()); };
    if (signal.aborted) return aborted();
    events.forEach((type) => video.addEventListener(type, check));
    video.addEventListener('error', failed, { once: true });
    signal.addEventListener('abort', aborted, { once: true });
    timer = setTimeout(failed, 15000);
    check();
  });
}

function inferFacingMode(track, fallback) {
  const settings = track.getSettings?.() || {};
  if (settings.facingMode === 'user' || settings.facingMode === 'environment') return settings.facingMode;
  if (/back|rear|environment/i.test(track.label)) return 'environment';
  if (/front|facetime|user|face/i.test(track.label)) return 'user';
  return fallback;
}

export class CaptureEngine extends EventTarget {
  #video;
  #stream = null;
  #ready = false;
  #facingMode = 'user';
  #deviceLabel = '';
  #deviceId = '';
  #revision = 0;
  #pending = null;
  #controller = null;
  #ownedStreams = new Set();
  #endedListeners = new Map();
  #onPageHide;

  constructor(videoElement) {
    super();
    if (!videoElement || videoElement.tagName?.toLowerCase() !== 'video') {
      throw new TypeError('CaptureEngine requires a video element.');
    }
    this.#video = videoElement;
    videoElement.autoplay = true;
    videoElement.muted = true;
    videoElement.playsInline = true;
    videoElement.setAttribute('playsinline', '');
    videoElement.setAttribute('muted', '');
    this.#onPageHide = () => this.stop();
    window.addEventListener('pagehide', this.#onPageHide);
  }

  get active() {
    return this.#ready && !!this.#stream?.getVideoTracks().some((track) => track.readyState === 'live');
  }
  get facingMode() { return this.#facingMode; }
  get deviceLabel() { return this.#deviceLabel; }
  get stream() { return this.#stream; }
  get busy() { return this.#pending !== null; }

  #state() {
    return { active: this.active, facingMode: this.#facingMode, deviceLabel: this.#deviceLabel };
  }

  #emitState() {
    this.dispatchEvent(new CustomEvent('statechange', { detail: this.#state() }));
  }

  #checkCurrent(revision, signal) {
    if (revision !== this.#revision || signal.aborted) throw cancelled();
  }

  #transition(task) {
    if (this.#pending) return this.#pending;
    const revision = ++this.#revision;
    const controller = new AbortController();
    this.#controller = controller;
    let operation;
    operation = Promise.resolve().then(async () => {
      try {
        this.#checkCurrent(revision, controller.signal);
        return await task(revision, controller.signal);
      } catch (error) {
        // A superseded request must never replace the current UI with its error.
        this.#checkCurrent(revision, controller.signal);
        throw error;
      } finally {
        if (this.#pending === operation) this.#pending = null;
        if (this.#controller === controller) this.#controller = null;
      }
    });
    this.#pending = operation;
    return operation;
  }

  async #request(selection, revision, signal) {
    assertCameraAvailable();
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { ...VIDEO_PREFERENCES, ...selection } });
    } catch (error) {
      this.#checkCurrent(revision, signal);
      if (!['OverconstrainedError', 'ConstraintNotSatisfiedError'].includes(error?.name)) throw error;
      // Retain the chosen device, but allow its native resolution.
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: selection });
      } catch (fallbackError) {
        this.#checkCurrent(revision, signal);
        throw fallbackError;
      }
    }
    if (revision !== this.#revision || signal.aborted) {
      stopTracks(stream);
      throw cancelled();
    }
    this.#ownedStreams.add(stream);
    return stream;
  }

  #release(stream) {
    if (!stream) return;
    const listeners = this.#endedListeners.get(stream) || [];
    listeners.forEach(([track, listener]) => track.removeEventListener('ended', listener));
    this.#endedListeners.delete(stream);
    this.#ownedStreams.delete(stream);
    stopTracks(stream);
    if (this.#stream === stream) {
      this.#ready = false;
      this.#stream = null;
      this.#deviceLabel = '';
      this.#deviceId = '';
    }
    if (this.#video.srcObject === stream) {
      this.#video.pause();
      this.#video.srcObject = null;
    }
  }

  async #activate(stream, facingMode, revision, signal) {
    this.#checkCurrent(revision, signal);
    const track = stream.getVideoTracks()[0];
    if (!track || track.readyState !== 'live') {
      this.#release(stream);
      throw cameraError('NotReadableError', 'The camera stream ended before it started.');
    }
    this.#stream = stream;
    this.#ready = false;
    this.#video.srcObject = stream;
    const ended = () => {
      if (this.#stream !== stream) return;
      this.stop();
      this.dispatchEvent(new CustomEvent('ended', { detail: this.#state() }));
    };
    track.addEventListener('ended', ended, { once: true });
    this.#endedListeners.set(stream, [[track, ended]]);
    const frameController = new AbortController();
    const abortFrame = () => frameController.abort();
    signal.addEventListener('abort', abortFrame, { once: true });
    try {
      await Promise.all([
        waitForVideoFrame(this.#video, frameController.signal),
        Promise.resolve(this.#video.play()),
      ]);
      this.#checkCurrent(revision, signal);
      this.#facingMode = inferFacingMode(track, facingMode);
      this.#deviceLabel = track.label || (this.#facingMode === 'user' ? 'Front camera' : 'Rear camera');
      this.#deviceId = track.getSettings?.().deviceId || '';
      this.#ready = true;
      this.#emitState();
      return this.#state();
    } catch (error) {
      this.#release(stream);
      throw error;
    } finally {
      signal.removeEventListener('abort', abortFrame);
      frameController.abort();
    }
  }

  /** Call only from a deliberate user action. Camera and microphone stay off until then. */
  start() {
    if (this.#pending) return this.#pending;
    if (this.active) return Promise.resolve(this.#state());
    return this.#transition(async (revision, signal) => {
      const stream = await this.#request({ facingMode: { ideal: 'user' } }, revision, signal);
      return this.#activate(stream, 'user', revision, signal);
    });
  }

  /** Also invalidates any permission request still waiting for a browser response. */
  stop() {
    ++this.#revision;
    this.#controller?.abort();
    this.#controller = null;
    this.#pending = null;
    [...this.#ownedStreams].forEach((stream) => this.#release(stream));
    this.#ready = false;
    this.#emitState();
  }

  /** Release before switching for mobile browsers; reopen the original on failure. */
  switchCamera() {
    if (this.#pending) return this.#pending;
    if (!this.active) return this.start();
    return this.#transition(async (revision, signal) => {
      const original = { facingMode: this.#facingMode, deviceId: this.#deviceId };
      const nextFacing = original.facingMode === 'user' ? 'environment' : 'user';
      let devices = [];
      try {
        devices = (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === 'videoinput');
      } catch { /* facingMode still works when device enumeration is unavailable. */ }
      this.#checkCurrent(revision, signal);
      const availableDevices = devices.filter((device) => device.deviceId && device.deviceId !== original.deviceId);
      if (devices.length === 1 || (devices.length > 0 && availableDevices.length === 0)) {
        throw cameraError('OnlyOneCameraError', 'There is one available camera.');
      }
      const labelPattern = nextFacing === 'user' ? /front|facetime|user|face/i : /back|rear|environment/i;
      const matchingDevice = availableDevices.find((device) => labelPattern.test(device.label));
      const currentIndex = devices.findIndex((device) => device.deviceId === original.deviceId);
      const followingDevice = devices.length > 1 ? devices[(Math.max(0, currentIndex) + 1) % devices.length] : null;
      const nextDevice = matchingDevice || followingDevice || availableDevices[0];
      const nextSelection = nextDevice
        ? { deviceId: { exact: nextDevice.deviceId } }
        : { facingMode: { exact: nextFacing } };

      this.#release(this.#stream);
      this.#emitState();
      try {
        const stream = await this.#request(nextSelection, revision, signal);
        const actualDevice = stream.getVideoTracks()[0]?.getSettings?.().deviceId;
        if (actualDevice && actualDevice === original.deviceId) {
          this.#release(stream);
          throw cameraError('OnlyOneCameraError', 'The browser returned the same camera.');
        }
        return await this.#activate(stream, nextFacing, revision, signal);
      } catch (error) {
        this.#checkCurrent(revision, signal);
        try {
          const restoreSelection = original.deviceId
            ? { deviceId: { exact: original.deviceId } }
            : { facingMode: { ideal: original.facingMode } };
          const stream = await this.#request(restoreSelection, revision, signal);
          await this.#activate(stream, original.facingMode, revision, signal);
          error.cameraMessage = error.name === 'OnlyOneCameraError'
            ? 'No other camera is available. Your original camera is still active.'
            : 'The other camera could not start. Your original camera is still active.';
        } catch (restoreError) {
          this.#checkCurrent(revision, signal);
          error.cameraMessage = 'The camera could not switch or reconnect. Enable the camera again to continue.';
          this.#emitState();
        }
        throw error;
      }
    });
  }

  async capture({ filter = 'color', exposure = 0, mirror = true, pose = null } = {}) {
    if (!this.active) throw cameraError('CameraInactiveError', 'The camera is off.');
    const width = this.#video.videoWidth;
    const height = this.#video.videoHeight;
    if (this.#video.readyState < 2 || !width || !height) {
      throw cameraError('CameraNotReadyError', 'No video frame is ready.');
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const frame = drawPhotoFrame(canvas, this.#video, {
      filter,
      exposure,
      mirror: mirror && this.#facingMode === 'user',
      pose,
    });
    if (!frame) throw cameraError('CameraNotReadyError', 'No video frame is ready.');
    const createdAt = new Date().toISOString();
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) resolve(result);
        else reject(cameraError('CaptureFailedError', 'Image encoding failed.'));
      }, 'image/jpeg', 0.94);
    });
    // The caller owns this URL and should revoke it when removing the photograph.
    return { blob, url: URL.createObjectURL(blob), width, height, createdAt, pose: frame.pose };
  }

  dispose() {
    this.stop();
    window.removeEventListener('pagehide', this.#onPageHide);
  }
}

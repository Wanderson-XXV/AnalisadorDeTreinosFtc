"""Camera probing tests that do not require a physical webcam."""

from aruco_tuning import camera


class _FakeCapture:
    created = []
    open_indices = {1}

    def __init__(self, index, backend):
        self.index = index
        self.backend = backend
        self.released = False
        type(self).created.append(self)

    def isOpened(self):
        return self.index in type(self).open_indices

    def get(self, _prop):
        return 1920

    def getBackendName(self):
        return "DSHOW"

    def release(self):
        self.released = True


def test_windows_auto_probe_uses_directshow_and_releases_every_slot(monkeypatch):
    _FakeCapture.created = []
    monkeypatch.setattr(camera.sys, "platform", "win32")
    monkeypatch.setattr(camera.cv2, "VideoCapture", _FakeCapture)

    found = camera.enumerate_cameras(max_index=3, backend="auto")

    assert [item["index"] for item in found] == [1]
    assert all(cap.backend == camera.cv2.CAP_DSHOW for cap in _FakeCapture.created)
    assert all(cap.released for cap in _FakeCapture.created)


def test_explicit_backend_does_not_fallback_to_cap_any():
    assert camera._backend_candidates("dshow", allow_fallback=True) == [
        camera.cv2.CAP_DSHOW
    ]

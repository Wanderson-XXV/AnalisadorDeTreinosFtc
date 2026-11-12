"""ArUco Tuning Prototype.

Real-time LEGO robot tracking and movement-tuning tool using ArUco markers
and a Logitech C920 (or any UVC) webcam.

The package is organised in layers:

* ``geometry``            - pure math helpers (angles, transforms, projections)
* ``models``              - shared dataclasses / enums
* ``camera``              - camera capture (real / file / demo)
* ``camera_calibration``  - ChArUco based intrinsic calibration
* ``aruco_detection``     - marker detection + blur estimation
* ``robot_pose``          - 6DOF pose estimation and arena transform
* ``arena``               - arena definition + zones
* ``arena_registration``  - camera <-> arena homography / PnP recovery
* ``tuning_test``         - test state machine + result calculation
* ``recording``           - video recording
* ``persistence``         - YAML / JSON / CSV load & save
* ``ui``                  - PySide6 user interface
"""

__version__ = "0.1.0"

__all__ = ["__version__"]

import 'dart:async';
import 'package:geolocator/geolocator.dart';
import 'package:shared_preferences/shared_preferences.dart';

class LocationService {
  LocationService._();
  static final LocationService instance = LocationService._();

  static const _keyLat = 'loc_lat';
  static const _keyLng = 'loc_lng';
  static const _keyAcc = 'loc_acc';

  Position? _last;
  StreamSubscription<Position>? _sub;
  final _controller = StreamController<Position>.broadcast();

  Position? get lastKnownPosition => _last;
  Stream<Position> get positionStream => _controller.stream;

  /// Loads persisted position and starts the GPS stream.
  /// Call once from main() or before the map screen.
  Future<void> init() async {
    await _loadCached();
    await _startStream();
  }

  Future<void> _loadCached() async {
    final prefs = await SharedPreferences.getInstance();
    final lat = prefs.getDouble(_keyLat);
    final lng = prefs.getDouble(_keyLng);
    final acc = prefs.getDouble(_keyAcc) ?? 0;
    if (lat != null && lng != null) {
      _last = Position(
        latitude: lat,
        longitude: lng,
        accuracy: acc,
        altitude: 0,
        altitudeAccuracy: 0,
        heading: 0,
        headingAccuracy: 0,
        speed: 0,
        speedAccuracy: 0,
        timestamp: DateTime.now(),
      );
    }
  }

  Future<void> _startStream() async {
    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) return;
    }
    if (permission == LocationPermission.deniedForever) return;

    const settings = LocationSettings(
      accuracy: LocationAccuracy.high,
      distanceFilter: 5,
    );

    _sub?.cancel();
    _sub = Geolocator.getPositionStream(locationSettings: settings).listen(
      (pos) {
        _last = pos;
        _controller.add(pos);
        _persist(pos);
      },
    );
  }

  /// Returns the cached position immediately if available, otherwise waits
  /// for the next GPS fix (up to [timeout]).
  Future<Position?> getPosition({Duration timeout = const Duration(seconds: 10)}) async {
    if (_last != null) return _last;
    try {
      return await positionStream.first.timeout(timeout);
    } catch (_) {
      return null;
    }
  }

  Future<void> _persist(Position pos) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setDouble(_keyLat, pos.latitude);
    await prefs.setDouble(_keyLng, pos.longitude);
    await prefs.setDouble(_keyAcc, pos.accuracy);
  }

  void dispose() {
    _sub?.cancel();
    _controller.close();
  }
}

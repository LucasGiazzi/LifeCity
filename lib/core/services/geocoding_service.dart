import 'dart:convert';

import 'package:http/http.dart' as http;

/// Reverse geocoding e busca de endereços via Nominatim (OpenStreetMap).
class GeocodingService {
  static const _userAgent = 'LifeCityApp/1.0';

  Future<String?> reverseGeocode(double lat, double lon) async {
    try {
      final url =
          'https://nominatim.openstreetmap.org/reverse?lat=$lat&lon=$lon&format=json&addressdetails=1';

      final response = await http.get(
        Uri.parse(url),
        headers: {'User-Agent': _userAgent},
      ).timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        return data['display_name'] as String?;
      }
    } catch (_) {}
    return null;
  }

  Future<List<Map<String, dynamic>>> searchAddresses(
    String query, {
    String regionSuffix = ', Brasil',
  }) async {
    if (query.trim().length < 3) return [];

    try {
      final encodedQuery = Uri.encodeComponent('${query.trim()}$regionSuffix');
      final url =
          'https://nominatim.openstreetmap.org/search?q=$encodedQuery&format=json&limit=5&addressdetails=1';

      final response = await http.get(
        Uri.parse(url),
        headers: {'User-Agent': _userAgent},
      ).timeout(const Duration(seconds: 5));

      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body);
        return data
            .map((item) => {
                  'display_name': item['display_name'] as String? ?? '',
                  'lat': item['lat'] as String? ?? '',
                  'lon': item['lon'] as String? ?? '',
                })
            .toList();
      }
    } catch (_) {}
    return [];
  }

  Future<({double lat, double lon})?> geocodeAddress(
    String address, {
    String regionSuffix = ', Brasil',
  }) async {
    try {
      final encoded = Uri.encodeComponent('${address.trim()}$regionSuffix');
      final url =
          'https://nominatim.openstreetmap.org/search?q=$encoded&format=json&limit=1';

      final response = await http.get(
        Uri.parse(url),
        headers: {'User-Agent': _userAgent},
      ).timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body);
        if (data.isNotEmpty) {
          final lat = double.tryParse(data[0]['lat'] ?? '');
          final lon = double.tryParse(data[0]['lon'] ?? '');
          if (lat != null && lon != null) {
            return (lat: lat, lon: lon);
          }
        }
      }
    } catch (_) {}
    return null;
  }
}

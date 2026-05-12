import 'package:flutter/foundation.dart';

class AppConfig {
  static const String _overrideApiBaseUrl = String.fromEnvironment('API_BASE_URL');

  static String get apiBaseUrl {
    if (_overrideApiBaseUrl.isNotEmpty) return _overrideApiBaseUrl;
    if (kIsWeb) return 'http://localhost:8081/api/v1';
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return 'http://10.0.2.2:8081/api/v1';
      case TargetPlatform.iOS:
      case TargetPlatform.macOS:
      case TargetPlatform.windows:
      case TargetPlatform.linux:
        return 'http://localhost:8081/api/v1';
      default:
        return 'http://172.20.10.4:8081/api/v1';
    }
  }
}

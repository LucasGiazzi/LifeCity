import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

class AuthService {
  final FirebaseAuth _auth = FirebaseAuth.instance;
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  // Sign in with email and password
  Future<UserCredential?> signInWithEmailAndPassword(String email, String password) async {
    try {
      UserCredential userCredential = await _auth.signInWithEmailAndPassword(
        email: email,
        password: password,
      );
      return userCredential;
    } on FirebaseAuthException {
      return null;
    }
  }

  // Sign up with email and password
  Future<UserCredential?> signUp(
      {required String email, required String password, required String name, required String cpf, required String phone}) async {
    UserCredential? userCredential;
    try {
      userCredential = await _auth.createUserWithEmailAndPassword(
        email: email,
        password: password,
      );
      
      await _createUserDocument(userCredential.user!, name, cpf, phone);
      
      return userCredential;
    } catch (e) {
      // If creating the user document fails, we must delete the user to avoid orphaned auth entries.
      if (userCredential != null) {
        await userCredential.user?.delete();
      }
      // Re-throw the error to be handled by the UI.
      rethrow;
    }
  }

  Future<void> _createUserDocument(User user, String name, String cpf, String phone) async {
    return _firestore.collection('users').doc(user.uid).set({
      'uid': user.uid,
      'email': user.email,
      'name': name,
      'cpf': cpf,
      'phone': phone,
      'createdAt': FieldValue.serverTimestamp(),
    });
  }

  // TODO: Add sign out method
  // TODO: Add stream for auth state changes
}

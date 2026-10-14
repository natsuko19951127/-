// Firebase SDKは設定がある場合だけ読み込みます。初期パスワードは配信しません。
(() => {
  let auth, db, functions, sdk, profile = null;
  let stops = [], generation = 0;
  const config = window.TEAMFLOW_FIREBASE_CONFIG || {};
  const options = window.TEAMFLOW_FIREBASE_OPTIONS || {};
  const ready = (async () => {
    if (!config.apiKey || !config.authDomain || !config.projectId || !config.appId) {
      throw new Error('Firebaseの設定がまだ入力されていません。管理者にお問い合わせください。');
    }
    const base = 'https://www.gstatic.com/firebasejs/12.19.0/';
    const [appSDK, authSDK, dbSDK, fnSDK] = await Promise.all([
      import(base + 'firebase-app.js'), import(base + 'firebase-auth.js'),
      import(base + 'firebase-firestore.js'), import(base + 'firebase-functions.js')
    ]);
    sdk = { ...authSDK, ...dbSDK, ...fnSDK };
    const app = appSDK.initializeApp(config);
    auth = sdk.getAuth(app);
    db = sdk.getFirestore(app);
    functions = sdk.getFunctions(app, options.functionsRegion || 'asia-northeast1');
    await auth.authStateReady();
  })();
  ready.catch(() => {});
  const emailFor = id => (options.staffEmails || {})[id] || `${id}@${config.projectId}.firebaseapp.com`;
  async function readProfile(user) {
    const snap = await sdk.getDoc(sdk.doc(db, 'staff_profiles', user.uid));
    if (!snap.exists() || snap.data().active !== true) throw new Error('このアカウントは利用できません。管理者にお問い合わせください。');
    const token = await user.getIdTokenResult(true), p = snap.data();
    if (token.claims.staffId !== p.staffId || token.claims.store !== p.store || token.claims.role !== p.role) {
      throw new Error('アカウントの所属設定を確認してください。');
    }
    profile = { ...p, uid: user.uid };
    return profile;
  }
  function stop() {
    generation++;
    stops.forEach(fn => fn()); stops = [];
  }
  window.teamflowFirebase = {
    ready,
    async login(id, password, remember) {
      await ready; stop();
      await sdk.setPersistence(auth, remember ? sdk.browserLocalPersistence : sdk.browserSessionPersistence);
      const result = await sdk.signInWithEmailAndPassword(auth, emailFor(id), password);
      try {
        const p = await readProfile(result.user);
        if (p.staffId !== id) throw new Error('選択したお名前とアカウントが一致しません。');
        return p;
      } catch (error) { profile = null; await sdk.signOut(auth); throw error; }
    },
    async restore() {
      await ready;
      if (!auth.currentUser) return null;
      try { return await readProfile(auth.currentUser); }
      catch (error) { await this.logout(); throw error; }
    },
    async logout() {
      stop(); profile = null;
      await ready;
      await sdk.signOut(auth);
    },
    subscribe(onReports, onChannels, onError) {
      if (!profile || profile.mustChangePassword) throw new Error('先にパスワードを変更してください。');
      stop();
      const scope = profile, epoch = generation;
      const from = new Date(); from.setDate(from.getDate() - 90);
      const since = `${from.getFullYear()}-${String(from.getMonth()+1).padStart(2,'0')}-${String(from.getDate()).padStart(2,'0')}`;
      const filter = scope.role === 'manager' ? sdk.where('store', '==', scope.store) : sdk.where('staffId', '==', scope.staffId);
      const reports = sdk.query(sdk.collection(db, 'nippo_reports'), filter, sdk.where('date', '>=', since));
      const fail = error => { if (generation === epoch) onError(error); };
      stops.push(sdk.onSnapshot(reports, { includeMetadataChanges: true }, snap => {
        if (generation !== epoch) return;
        onReports(snap.docs.map(d => d.data()), snap.metadata);
      }, fail));
      if (scope.role === 'manager') {
        const channels = sdk.query(sdk.collection(db, 'nippo_store_days'), sdk.where('store', '==', scope.store), sdk.where('date', '>=', since));
        stops.push(sdk.onSnapshot(channels, snap => {
          if (generation === epoch) onChannels(snap.docs.map(d => d.data()));
        }, fail));
      }
    },
    async saveReport(date, staffId, day) {
      if (!profile || profile.mustChangePassword || staffId !== profile.staffId) throw new Error('自分の日報だけ保存できます。');
      return sdk.setDoc(sdk.doc(db, 'nippo_reports', `${date}_${staffId}`), {
        date, staffId, store: profile.store, day,
        updatedAt: sdk.serverTimestamp()
      });
    },
    async saveChannels(date, store, channels) {
      if (!profile || profile.role !== 'manager' || store !== profile.store) throw new Error('自店だけ保存できます。');
      return sdk.setDoc(sdk.doc(db, 'nippo_store_days', `${date}_${store}`), {
        date, store, channels, updatedAt: sdk.serverTimestamp()
      });
    },
    async changePassword(currentPassword, newPassword) {
      await ready;
      const user = auth.currentUser;
      if (!user) throw new Error('ログインし直してください。');
      await sdk.reauthenticateWithCredential(user, sdk.EmailAuthProvider.credential(user.email, currentPassword));
      await user.getIdToken(true);
      await sdk.httpsCallable(functions, 'changeOwnPassword')({ password: newPassword });
      return readProfile(user);
    },
    async resetPassword(staffId) {
      await ready;
      return (await sdk.httpsCallable(functions, 'resetStaffPassword')({ staffId })).data;
    },
    async resetInfo() {
      await ready;
      return (await sdk.httpsCallable(functions, 'getResetPasswords')({})).data;
    },
    onSignedOut(callback) {
      ready.then(() => sdk.onAuthStateChanged(auth, user => {
        if (!user && profile) { stop(); profile = null; callback(); }
      })).catch(() => {});
    }
  };
})();

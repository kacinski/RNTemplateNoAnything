import React, {Component} from 'react';
import {
  Alert,
  BackHandler,
  Vibration,
  StyleSheet,
  Text,
  View,
  Platform,
  PermissionsAndroid,
  StatusBar,
  Image,
  SafeAreaView,
  Linking,
} from 'react-native';

import {WebView} from 'react-native-webview';
import NetInfo from '@react-native-community/netinfo';
import OneSignal from 'react-native-onesignal';
import createInvoke from 'react-native-webview-invoke/native';
import {launchCamera, launchImageLibrary} from 'react-native-image-picker';
import FingerprintScanner from 'react-native-fingerprint-scanner';
import Share from 'react-native-share';

/** Contacts */
//import Contacts from 'react-native-contacts';

/** IN-APP Purchase */
//import * as RNIap from 'react-native-iap';

import Geolocation from '@react-native-community/geolocation';
import RNBootSplash from 'react-native-bootsplash';

OneSignal.setAppId('22d1a9d2-0e81-4906-acff-13c98c1a6847');

/* Fullscreen */
const setFullscreenWithoutBar = false; //Без шторки
const setFullscreenWithBar = false; // с шторкой
const userURL = 'https://www.zeroqode.com/'; //ссылка на приложение юзера
const bootsplashColor = '#FFFFFF';

if (setFullscreenWithoutBar || setFullscreenWithBar) {
  StatusBar.setTranslucent(true); //если нужно чтоб приложение на android было под status bar -> true
}

if (setFullscreenWithoutBar) {
  StatusBar.setHidden(true);
}

if (setFullscreenWithBar) {
  StatusBar.setHidden(false);
  StatusBar.setBackgroundColor('#FFFFFF00');
}

const INJECTED_JAVASCRIPT = `(function() {
  const meta = document.createElement('meta'); meta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no'); meta.setAttribute('name', 'viewport'); document.getElementsByTagName('head')[0].appendChild(meta);
})();`;

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      iapEnabled: false, // set TRUE if need in-app purchases
      contactsEnabled: false, //set TRUE if need native contacts
      isConnected: true,
      filePath: null,
      fileData: null,
      fileUri: null,
      isAvailable: null,
      watchID: null,
      firstLoad: true,
      productIds: [],
      products: [],
      headerColor: '#FFC529',
      headerVisible: false,
      bgColor: '#FFF',
      centerButtonFN: function () {},
      rightButtonFN: function () {},
    };
  }

  componentDidMount() {
    if (this.state.iapEnabled) {
      RNIap.initConnection();
    }

    BackHandler.addEventListener('hardwareBackPress', this.backAction);

    this.invoke.define('biometrycScan', this.biometrycScan);
    this.invoke.define('oneSignalGetId', this.oneSignalGetId);
    this.invoke.define('alertWord', this.alertWord);
    this.invoke.define('stopScaner', this.stopScaner);
    this.invoke.define('vibration', this.makeBrr);
    this.invoke.define('camera', this.getCamera);
    this.invoke.define('share', this.share);
    this.invoke.define('startLocationTracking', this.startLocationTracking);
    this.invoke.define('stopLocationTracking', this.stopLocationTracking);
    this.invoke.define('setStatusBarColor', this.setStatusBarColor);

    if (this.state.contactsEnabled) {
      this.invoke.define('getContacts', this.getContacts);
    }

    if (this.state.iapEnabled) {
      this.invoke.define('requestPurchase', this.requestPurchase);
      this.invoke.define('fetchProducts', this.fetchProducts);
      this.invoke.define('fetchSubscriptions', this.fetchSubscriptions);
      this.invoke.define('restorePurchase', this.goToRestore);
      this.invoke.define('getAllProducts', this.getAllProducts);
    }

    NetInfo.addEventListener(state => {
      this.setState({
        isConnected: state.isConnected,
      });
      this.render();
    });
  }

  componentWillUnmount() {
    if (this.state.iapEnabled) {
      RNIap.endConnection();
    }
  }

  /** Contacts */
  getContacts = () => {
    return new Promise((resolve, reject) => {
      Contacts.checkPermission().then(permission => {
        if (permission === 'undefined') {
          Contacts.requestPermission().then(() => {
            resolve(this.getContacts());
          });
        }
        if (permission === 'authorized') {
          Contacts.getAll().then(contacts => {
            let listOfContacts = contacts.map((contact, index, array) => {
              return {
                _p_familyName: contact.familyName,
                _p_givenName: contact.givenName,
                _p_middleName: contact.middleName,
                _p_firstNumber:
                  contact.phoneNumbers[0] !== undefined
                    ? contact.phoneNumbers[0].number
                    : '',
                _p_secondNumber:
                  contact.phoneNumbers[1] !== undefined
                    ? contact.phoneNumbers[1].number
                    : '',
                _p_thirdNumber:
                  contact.phoneNumbers[2] !== undefined
                    ? contact.phoneNumbers[2].number
                    : '',
                _p_birthday:
                  contact.birthday !== null && contact.birthday !== undefined
                    ? new Date(
                        contact.birthday.year,
                        contact.birthday.month,
                        contact.birthday.day,
                      )
                    : null,
                _p_emailAddress:
                  contact.emailAddresses[0] !== undefined
                    ? contact.emailAddresses[0].email
                    : '',
              };
            });
            resolve(listOfContacts);
          });
        }
        if (permission === 'denied') {
          resolve('Permission to contacts denied!');
        }
      });
    });
  };
  /** -------- */

  /** In-App functions */
  fetchProducts = products => {
    RNIap.getProducts(products).then(list => {
      let data;
      if (this.state.products.length > 0) {
        data = this.state.products.concat(list);
      } else {
        data = list;
      }

      this.setState({products: data});
      this.triggerEvent('products_is_fetched');
    });
  };

  fetchSubscriptions = subs => {
    RNIap.getSubscriptions(subs).then(list => {
      let data;
      if (this.state.products.length > 0) {
        data = this.state.products.concat(list);
      } else {
        data = list;
      }

      this.setState({products: data});
      this.triggerEvent('subscriptions_is_fetched');
    });
  };

  requestPurchase = async sku => {
    try {
      let purchaseData = await RNIap.requestPurchase(sku, false);
      return JSON.stringify(purchaseData);
    } catch (err) {
      Alert.alert(err.code, err.message);
    }
  };

  getAllProducts = () => {
    var listOfProducts = [];
    this.state.products.forEach(p => {
      listOfProducts.push({
        _p_Title: p.title,
        '_p_Product ID': p.productId,
        _p_Currency: p.currency,
        _p_Price: p.price,
      });
    });
    return listOfProducts;
  };

  goToRestore = (pack_name, product_id) => {
    if (Platform.OS === 'ios') {
      Linking.openURL('https://apps.apple.com/account/subscriptions');
    } else {
      if (
        pack_name !== null &&
        pack_name !== undefined &&
        product_id !== null &&
        product_id !== undefined
      ) {
        Linking.openURL(
          `https://play.google.com/store/account/subscriptions?package=${pack_name}&sku=${product_id}`,
        );
      }
    }
  };
  /** In-App End */

  /** Функция для отключения Splash Scree */
  firstLoadEnd = () => {
    if (this.state.firstLoad) {
      this.setState({
        firstLoad: false,
        rightButtonFN: this.triggerRightButton,
        centerButtonFN: this.triggerCenterButton,
      }); //Указываем что первая загрузка была и более сплэш скрин нам не нужен
      RNBootSplash.hide(); // Отключаем сплэш скрин
    }
  };

  toggleHeaderButton = () => {
    this.setState({
      headerVisible: !this.state.headerVisible,
    });
  };

  setHeaderButtonColor = color => {
    this.setState({
      headerColor: color,
    });
  };

  /** Status Bar Settings */
  setStatusBarColor = (
    color = '#000000',
    animated = true,
    barStyle = 'default',
    barAnimated = true,
  ) => {
    /** Возвможные стили бара 'default', 'dark-content', 'light-content' */
    //console.log(barStyle);
    StatusBar.setBarStyle(barStyle, barAnimated);
    //StatusBar.setNetworkActivityIndicatorVisible();
    if (Platform.OS !== 'ios') {
      //ios не поддерживает изменения цвета

      if (color === undefined || color === null) {
        color = '#ffffff';
      }

      if (animated === undefined || animated === null) {
        animated = true;
      }

      StatusBar.setBackgroundColor(color, animated);
    } else if (color !== '#000000' && color !== null && color !== undefined) {
      this.setState({bgColor: color});
    }
  };

  /** Status Bar Settings End */

  /** Geodata Settings */
  geoSuccess = position => {
    this.publishState('current_position', {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    });

    this.publishState('speed', position.coords.speed); // Скорость движения
    this.publishState('heading', position.coords.heading); // Направление
    this.publishState('altitude', position.coords.altitude); // Высота
  };

  geoError = error => {
    Alert.alert('Geo Error:', `${JSON.stringify(error)}`);
    /** Нужно придумать что-то для вывода ошибок, а то бесит через алёрты это делать
     * Может быть тригерить евент "Ошибка" и в стэйт передавать инфо о ошибке.
     */
  };

  startLocationTracking = (
    hightAccuracy = true,
    distance = 5,
    maximumAge = 30,
  ) => {
    /** Перестраховка значений по умолчнанию */
    if (hightAccuracy === null || hightAccuracy === undefined) {
      hightAccuracy = true;
    }
    if (distance === null || distance === undefined) {
      distance = 5;
    }
    if (maximumAge === null || maximumAge === undefined) {
      maximumAge = 30;
    }

    Geolocation.getCurrentPosition(this.geoSuccess, this.geoError, {
      enableHighAccuracy: hightAccuracy, // Если true - GPS, иначе WIFI
    });
    /** watchID это уникальный ID геосессии, по нему можно прекратить геосессию */
    let watchID = Geolocation.watchPosition(this.geoSuccess, this.geoError, {
      enableHighAccuracy: hightAccuracy, // Если true - GPS, иначе WIFI
      distanceFilter: distance, //Дистанция после изменения которой снова можно запрашивать геолокация ( вроде в метрах )
      maximumAge: maximumAge, //Время жизни кэша позиции в миллисекундах
    });

    this.setState({
      watchID: watchID,
    });
  };

  stopLocationTracking = () => {
    if (this.state.watchID !== null) {
      Geolocation.clearWatch(this.state.watchID); //Работает как очистка interval
    }

    this.setState({
      watchID: null,
    });
  };

  /** End geodata settings */

  share = options => {
    Share.open(options)
      .then(res => {
        console.log(res);
      })
      .catch(err => {
        err && console.log(err);
      });
  };

  requiresLegacyAuthentication = () => {
    return Platform.Version < 23;
  };

  authCurrent = () => {
    if (Platform.OS === 'ios') {
      FingerprintScanner.authenticate({
        description: 'Log in with Biometrics',
      })
        .then(() => {
          this.triggerByometrycs(true);
        })
        .catch(error => {
          Alert.alert(`${error.message}`);
        });
    } else {
      FingerprintScanner.authenticate({
        title: 'Log in with Biometrics',
      }).then(() => {
        this.triggerByometrycs(true);
      });
    }
  };

  oneSignalGetId = async () => {
    return await OneSignal.getDeviceState();
  };

  alertWord = (title, text) => {
    Alert.alert(title, text);
  };

  stopScaner = () => {
    FingerprintScanner.release();
  };

  authLegacy = () => {
    FingerprintScanner.authenticate({
      title: 'Log in with Biometrics',
    })
      .then(() => {
        this.triggerByometrycs(true);
      })
      .catch(error => {
        this.triggerByometrycs(false);
      });
  };

  backAction = e => {
    this.webview.goBack();
    return true;
  };

  makeBrr = seconds => {
    let ms = 1000;
    if (seconds === undefined || seconds === null) {
      Vibration.vibrate();
    } else {
      let duration = 1;

      if (typeof seconds === 'number') {
        duration = seconds;
      } else if (typeof seconds === 'string') {
        duration = parseInt(seconds);
      }

      Vibration.vibrate(duration * ms);
    }
  };

  invoke = createInvoke(() => this.webview);

  biometrycScan = () => {
    if (Platform.OS === 'android' && !this.requiresLegacyAuthentication()) {
      this.authLegacy();
    } else {
      this.authCurrent();
    }
  };

  triggerByometrycs = this.invoke.bind('triggerScanResult');
  /** Извлекаем прямо из бабла функции, тут же можно прописать загрузку файлов в bubble */
  publishState = this.invoke.bind('publishState');
  triggerEvent = this.invoke.bind('triggerEvent');
  canUploadFile = this.invoke.bind('canUploadFile');
  uploadFile = this.invoke.bind('uploadFile');

  triggerRightButton = this.invoke.bind('rightButton');
  triggerCenterButton = this.invoke.bind('centerButton');

  permissionsGet = () => {
    PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
      PermissionsAndroid.PERMISSIONS.CAMERA,
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
    );
  };

  loadEndFunction = () => {
    /** Функции для выполнения при полной загрузке страницы в WebView. Скорее всего RN Loader будет отключаться отсюда */
    if (Platform.OS !== 'ios') {
      this.permissionsGet();
    }
    this.firstLoadEnd();
    this.publishState('platform_os', Platform.OS); //Возвращаем операционку
  };

  runFunction = fun => {
    if (typeof fun === 'function') {
      fun();
    }
  };

  onContentProcessDidTerminate = () => this.webview.reload();

  render() {
    if (this.state.isConnected) {
      if (setFullscreenWithoutBar || setFullscreenWithBar) {
        return (
          <View
            style={{
              ...styles.safeareastyle,
              backgroundColor: this.state.bgColor,
            }}>
            <WebView
              useWebKit
              injectedJavaScript={INJECTED_JAVASCRIPT}
              ref={ref => (this.webview = ref)}
              onContentProcessDidTerminate={this.onContentProcessDidTerminate}
              onMessage={this.invoke.listener}
              allowsBackForwardNavigationGestures={true}
              allowsInlineMediaPlayback={true}
              startInLoadingState={true}
              sharedCookiesEnabled={true}
              renderLoading={() => {
                return (
                  <View
                    style={{
                      backgroundColor: bootsplashColor, //Bootsplash color
                      height: '100%',
                      width: '100%',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}>
                    <Image
                      style={{width: 100, height: 100}}
                      source={require('./sources/boot.png')} //Bootsplash image
                    />
                  </View>
                );
              }}
              source={{
                uri: userURL,
              }}
              onLoadEnd={this.loadEndFunction}
            />
          </View>
        );
      } else {
        return (
          <SafeAreaView
            style={{
              ...styles.safeareastyle,
              backgroundColor: this.state.bgColor,
            }}>
            <WebView
              useWebKit
              injectedJavaScript={INJECTED_JAVASCRIPT}
              ref={ref => (this.webview = ref)}
              onContentProcessDidTerminate={this.onContentProcessDidTerminate}
              onMessage={this.invoke.listener}
              allowsBackForwardNavigationGestures={true}
              allowsInlineMediaPlayback={true}
              startInLoadingState={true}
              sharedCookiesEnabled={true}
              renderLoading={() => {
                return (
                  <View
                    style={{
                      backgroundColor: bootsplashColor, //Bootsplash color
                      height: '100%',
                      width: '100%',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}>
                    <Image
                      style={{width: 100, height: 100}}
                      source={require('./sources/boot.png')} //Bootsplash image
                    />
                  </View>
                );
              }}
              source={{
                uri: userURL,
              }}
              onLoadEnd={this.loadEndFunction}
            />
          </SafeAreaView>
        );
      }
    } else {
      if (setFullscreenWithoutBar || setFullscreenWithBar) {
        return (
          <View style={styles.containerNoInternet}>
            <Image
              source={require('./sources/no_internet.png')}
              style={styles.imagestyle}
              onLoadEnd={this.firstLoadEnd()}
            />
          </View>
        );
      } else {
        this.setStatusBarColor();
        return (
          <SafeAreaView style={styles.containerNoInternet}>
            <Image
              source={require('./sources/no_internet.png')}
              style={styles.imagestyle}
              onLoadEnd={this.firstLoadEnd()}
            />
          </SafeAreaView>
        );
      }
      
    }
  }
}

const styles = StyleSheet.create({
  safeareastyle: {
    flex: 1,
  },
  imagestyle: {
    resizeMode: 'contain',
    width: '100%',
  },
});

export default App;
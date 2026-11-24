import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { DialogProvider } from './src/context/DialogContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
    return (
        <SafeAreaProvider>
            <AuthProvider>
                <DialogProvider>
                    <View style={styles.container}>
                        <View style={styles.mobileFrame}>
                            <NavigationContainer>
                                <StatusBar style="light" />
                                <AppNavigator />
                            </NavigationContainer>
                        </View>
                    </View>
                </DialogProvider>
            </AuthProvider>
        </SafeAreaProvider>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Platform.OS === 'web' ? '#0a1a0f' : '#fff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    mobileFrame: {
        flex: 1,
        width: '100%',
        maxWidth: Platform.OS === 'web' ? 460 : '100%',
        backgroundColor: '#fff',
        overflow: 'hidden',
        ...(Platform.OS === 'web' ? {
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
            borderLeftWidth: 1,
            borderRightWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.1)',
        } : {})
    },
});

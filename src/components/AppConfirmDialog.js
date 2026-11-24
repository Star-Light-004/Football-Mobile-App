import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function AppConfirmDialog({
    visible,
    title = 'Xác nhận thao tác',
    message = '',
    confirmText = 'Xác nhận',
    cancelText = 'Hủy bỏ',
    confirmColor = '#dc2626',
    iconName = 'alert-circle',
    iconColor = '#dc2626',
    isAlert = false,
    onConfirm,
    onCancel,
}) {
    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onCancel || onConfirm}
        >
            <View style={styles.overlay}>
                <View style={styles.card}>
                    <View style={[styles.iconWrapper, { backgroundColor: `${iconColor}15` }]}>
                        <Ionicons name={iconName} size={30} color={iconColor} />
                    </View>

                    <Text style={styles.title}>{title}</Text>
                    {Boolean(message) && <Text style={styles.message}>{message}</Text>}

                    <View style={styles.btnRow}>
                        {!isAlert && (
                            <TouchableOpacity
                                style={styles.cancelBtn}
                                onPress={onCancel}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.cancelBtnText}>{cancelText}</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={[
                                styles.confirmBtn,
                                { backgroundColor: confirmColor, flex: isAlert ? 1 : 1.2 }
                            ]}
                            onPress={onConfirm}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.confirmBtnText}>{confirmText}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        zIndex: 99999,
    },
    card: {
        width: '100%',
        maxWidth: 380,
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 22,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.25,
        shadowRadius: 24,
        elevation: 12,
    },
    iconWrapper: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 14,
    },
    title: {
        fontSize: 17,
        fontWeight: '800',
        color: '#0f172a',
        textAlign: 'center',
        marginBottom: 8,
    },
    message: {
        fontSize: 13.5,
        lineHeight: 20,
        color: '#64748b',
        textAlign: 'center',
        marginBottom: 20,
    },
    btnRow: {
        flexDirection: 'row',
        width: '100%',
        gap: 10,
    },
    cancelBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelBtnText: {
        fontSize: 13.5,
        fontWeight: '700',
        color: '#475569',
    },
    confirmBtn: {
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
    },
    confirmBtnText: {
        fontSize: 13.5,
        fontWeight: '700',
        color: '#ffffff',
    },
});


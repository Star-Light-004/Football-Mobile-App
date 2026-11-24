import React, { createContext, useContext, useState, useEffect } from 'react';
import { Alert } from 'react-native';
import AppConfirmDialog from '../components/AppConfirmDialog';

const DialogContext = createContext(null);

export const DialogProvider = ({ children }) => {
    const [dialogConfig, setDialogConfig] = useState({
        visible: false,
        title: '',
        message: '',
        confirmText: 'Xác nhận',
        cancelText: 'Hủy bỏ',
        confirmColor: '#006b2c',
        iconName: 'alert-circle',
        iconColor: '#006b2c',
        isAlert: false,
        onConfirm: () => {},
        onCancel: () => {},
    });

    const showAlert = (title, message, icon = 'alert-circle', color = '#006b2c', onDismiss) => {
        setDialogConfig({
            visible: true,
            title: title || 'Thông báo',
            message: message || '',
            confirmText: 'Đã hiểu',
            cancelText: 'Đóng',
            confirmColor: color === '#15803d' ? '#006b2c' : color,
            iconName: icon,
            iconColor: color,
            isAlert: true,
            onConfirm: () => {
                setDialogConfig(prev => ({ ...prev, visible: false }));
                if (onDismiss) onDismiss();
            },
            onCancel: () => {
                setDialogConfig(prev => ({ ...prev, visible: false }));
                if (onDismiss) onDismiss();
            },
        });
    };

    const showConfirm = ({
        title = 'Xác nhận thao tác',
        message = '',
        confirmText = 'Xác nhận',
        cancelText = 'Hủy bỏ',
        confirmColor = '#dc2626',
        iconName = 'alert-circle',
        iconColor = '#dc2626',
        onConfirm,
        onCancel,
    }) => {
        setDialogConfig({
            visible: true,
            title,
            message,
            confirmText,
            cancelText,
            confirmColor,
            iconName,
            iconColor,
            isAlert: false,
            onConfirm: async () => {
                setDialogConfig(prev => ({ ...prev, visible: false }));
                if (onConfirm) await onConfirm();
            },
            onCancel: () => {
                setDialogConfig(prev => ({ ...prev, visible: false }));
                if (onCancel) onCancel();
            },
        });
    };

    // Override Alert.alert on Web so React Native Web never pops up browser window.alert
    useEffect(() => {
        const originalAlert = Alert.alert;
        Alert.alert = (title, message, buttons) => {
            if (Array.isArray(buttons) && buttons.length > 1) {
                const cancelBtn = buttons.find(b => b.style === 'cancel') || buttons[0];
                const confirmBtn = buttons.find(b => b.style !== 'cancel') || buttons[1] || buttons[0];
                const isDestructive = confirmBtn.style === 'destructive';
                showConfirm({
                    title: title || 'Xác nhận',
                    message: message || '',
                    confirmText: confirmBtn.text || 'Xác nhận',
                    cancelText: cancelBtn.text || 'Hủy',
                    confirmColor: isDestructive ? '#dc2626' : '#006b2c',
                    iconName: isDestructive ? 'trash-outline' : 'help-circle-outline',
                    iconColor: isDestructive ? '#dc2626' : '#006b2c',
                    onConfirm: confirmBtn.onPress,
                    onCancel: cancelBtn.onPress,
                });
            } else {
                const singleBtn = Array.isArray(buttons) && buttons[0];
                const isErr = String(title || '').toLowerCase().includes('lỗi') || String(title || '').toLowerCase().includes('thất bại');
                const isSuccess = String(title || '').toLowerCase().includes('thành công');
                showAlert(
                    title,
                    message,
                    isSuccess ? 'checkmark-circle' : isErr ? 'alert-circle' : 'information-circle',
                    isSuccess ? '#006b2c' : isErr ? '#dc2626' : '#0284c7',
                    singleBtn?.onPress
                );
            }
        };

        return () => {
            Alert.alert = originalAlert;
        };
    }, []);

    return (
        <DialogContext.Provider value={{ showAlert, showConfirm }}>
            {children}
            <AppConfirmDialog {...dialogConfig} />
        </DialogContext.Provider>
    );
};

export const useDialog = () => {
    const ctx = useContext(DialogContext);
    if (!ctx) {
        return {
            showAlert: () => {},
            showConfirm: () => {},
        };
    }
    return ctx;
};

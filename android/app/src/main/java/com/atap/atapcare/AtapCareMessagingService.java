package com.atap.atapcare;

import android.app.Activity;
import android.app.Application;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.graphics.BitmapFactory;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;

import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;

// Render notif FCM sendiri supaya logo AtapCare muncul (largeIcon) dan notif
// mengambang/bersuara (channel HIGH). Tanpa ini, FCM SDK merender notif dengan
// small icon launcher yang Android mask jadi putih polos.
//
// Pesan dikirim data-only dari send-push (tanpa blok notification), jadi FCM
// tidak auto-render dan onMessageReceived selalu dipanggil untuk semua state.
public class AtapCareMessagingService extends MessagingService {

    private static final String CHANNEL_ID = "atapcare_notifications";
    private static int startedActivities = 0;

    private final Application.ActivityLifecycleCallbacks tracker = new Application.ActivityLifecycleCallbacks() {
        @Override
        public void onActivityStarted(@NonNull Activity activity) {
            startedActivities++;
        }

        @Override
        public void onActivityStopped(@NonNull Activity activity) {
            startedActivities = Math.max(0, startedActivities - 1);
        }

        @Override
        public void onActivityCreated(@NonNull Activity activity, android.os.Bundle savedInstanceState) {}

        @Override
        public void onActivityResumed(@NonNull Activity activity) {}

        @Override
        public void onActivityPaused(@NonNull Activity activity) {}

        @Override
        public void onActivitySaveInstanceState(@NonNull Activity activity, @NonNull android.os.Bundle outState) {}

        @Override
        public void onActivityDestroyed(@NonNull Activity activity) {}
    };

    @Override
    public void onCreate() {
        super.onCreate();
        // ponytail: counter sederhana per-proses; butuh akurasi antar-proses?
        // service dan activity selalu satu proses app, jadi cukup.
        ((Application) getApplicationContext()).registerActivityLifecycleCallbacks(tracker);
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        // Penting: biarkan plugin dulu — in-app event pushNotificationReceived
        // + chime/sheet tetap jalan saat app terbuka.
        super.onMessageReceived(remoteMessage);

        String title = remoteMessage.getData().get("title");
        String body = remoteMessage.getData().get("body");
        if (title == null && body == null) return;

        // App foreground: sheet in-app yang menangani, jangan dobel tampil notify OS.
        if (startedActivities > 0) return;

        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        nm.createNotificationChannel(
                new NotificationChannel(CHANNEL_ID, "Atap Care", NotificationManager.IMPORTANCE_HIGH));

        Intent intent = new Intent(this, MainActivity.class);
        intent.setAction(Intent.ACTION_MAIN);
        intent.addCategory(Intent.CATEGORY_LAUNCHER);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        String url = remoteMessage.getData().get("url");
        if (url != null) intent.putExtra("url", url);
        PendingIntent pi = PendingIntent.getActivity(
                this, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification n = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setLargeIcon(BitmapFactory.decodeResource(getResources(), R.mipmap.ic_launcher))
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setAutoCancel(true)
                .setContentIntent(pi)
                .build();

        String ticketId = remoteMessage.getData().get("ticket_id");
        int id = ticketId != null ? ticketId.hashCode() : (int) System.currentTimeMillis();
        nm.notify(null, id, n);
    }
}
package com.personalbrain.backstage;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    createNotificationChannel();
  }

  private void createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      NotificationChannel channel = new NotificationChannel(
        "default",
        "BACKSTAGE",
        NotificationManager.IMPORTANCE_HIGH
      );
      channel.setDescription("Notifications BACKSTAGE");
      NotificationManager manager = getSystemService(NotificationManager.class);
      manager.createNotificationChannel(channel);
    }
  }
}

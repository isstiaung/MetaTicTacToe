package me.isstiaung.metatictactoe;

import android.content.Intent;
import android.support.design.widget.NavigationView;
import android.support.v4.view.GravityCompat;
import android.support.v4.widget.DrawerLayout;
import android.support.v7.app.ActionBar;
import android.support.v7.app.AppCompatActivity;
import android.os.Bundle;
import android.support.v7.widget.Toolbar;
import android.view.MenuItem;
import android.view.View;

import me.isstiaung.metatictactoe.controllers.UIController;

import static me.isstiaung.metatictactoe.utils.Utils.log;


public class MainBoardActivity extends AppCompatActivity {
    UIController uiController;
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        log("on create");
        uiController = new UIController(this);
        uiController.start();
    }

    public void startLandingActivity(){
        startActivity(new Intent(MainBoardActivity.this,LandingActivity.class));
    }
}

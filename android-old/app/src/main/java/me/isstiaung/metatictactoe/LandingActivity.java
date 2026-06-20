package me.isstiaung.metatictactoe;

import android.content.DialogInterface;
import android.content.Intent;
import android.net.Uri;
import android.support.v7.app.AlertDialog;
import android.support.v7.app.AppCompatActivity;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;

import static me.isstiaung.metatictactoe.utils.Utils.log;

public class LandingActivity extends AppCompatActivity {
    Button newGame,rules;
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_landing);
        newGame = this.findViewById(R.id.new_game);
        newGame.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                log("in on click");
                LandingActivity.this.startActivity(new Intent(LandingActivity.this,MainBoardActivity.class));
            }
        });
        rules = this.findViewById(R.id.rules);
        rules.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showConfirmDialog();
            }
        });
    }

    void showConfirmDialog(){
        new AlertDialog.Builder(this)
                .setTitle("Open Browser")
                .setMessage("Open link to rules in browser?")
                .setIcon(android.R.drawable.ic_dialog_alert)
                .setPositiveButton(android.R.string.yes, new DialogInterface.OnClickListener() {

                    public void onClick(DialogInterface dialog, int whichButton) {
                        Uri uri = Uri.parse("https://isstiaung.me/meta-tictactoe-rules-6ac9bc68d079"); // missing 'http://' will cause crashed
                        Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                        startActivity(intent);
                    }})
                .setNegativeButton(android.R.string.no, null).show();
    }
}

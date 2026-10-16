package ru.napare.app;

import android.app.*;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.text.InputFilter;
import android.text.InputType;
import android.view.Gravity;
import android.widget.*;
import java.io.IOException;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

/** Native organizer remains available without Internet or a university account. */
public final class OfflinePlanActivity extends Activity {
    private PlanRepository repository;
    private LinearLayout root, list;
    private LocalDate day = LocalDate.now();
    private final DateTimeFormatter dateFormat=DateTimeFormatter.ofPattern("d MMMM, EEEE",new Locale("ru"));
    @Override public void onCreate(Bundle state) {
        super.onCreate(state); repository=new PlanRepository(getFilesDir());
        if (state!=null) day=LocalDate.parse(state.getString("day",day.toString()));
        root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(Color.rgb(247,248,252));root.setFitsSystemWindows(true);
        setContentView(root);render();
        if(android.os.Build.VERSION.SDK_INT>=30)root.setOnApplyWindowInsetsListener((view,insets)->{android.graphics.Insets bars=insets.getInsets(android.view.WindowInsets.Type.systemBars()|android.view.WindowInsets.Type.displayCutout()|android.view.WindowInsets.Type.ime());view.setPadding(bars.left,bars.top,bars.right,bars.bottom);return insets;});
    }
    @Override protected void onSaveInstanceState(Bundle state) { state.putString("day",day.toString());super.onSaveInstanceState(state); }
    private void render() {
        root.removeAllViews();
        LinearLayout heading=row();heading.addView(button("Назад",this::finish));
        TextView title=text("План офлайн",23);heading.addView(title,new LinearLayout.LayoutParams(0,-2,1));root.addView(heading);
        TextView info=text("На устройстве · без синхронизации с аккаунтом",13);info.setPadding(dp(16),dp(8),dp(16),dp(8));root.addView(info);
        LinearLayout dates=row();dates.addView(button("‹",()->{day=day.minusDays(1);render();}));
        Button selected=button(day.format(dateFormat),()->new DatePickerDialog(this,(view,y,m,d)->{day=LocalDate.of(y,m+1,d);render();},day.getYear(),day.getMonthValue()-1,day.getDayOfMonth()).show());dates.addView(selected,new LinearLayout.LayoutParams(0,-2,1));
        dates.addView(button("›",()->{day=day.plusDays(1);render();}));root.addView(dates);
        LinearLayout actions=row();actions.addView(button("Добавить",()->edit(null)));actions.addView(button("Сегодня",()->{day=LocalDate.now();render();}));actions.addView(button("Ещё",this::more));root.addView(actions);
        ScrollView scroll=new ScrollView(this);list=new LinearLayout(this);list.setOrientation(LinearLayout.VERTICAL);list.setPadding(dp(16),dp(8),dp(16),dp(24));scroll.addView(list);root.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
        try {
            int count=0;
            for (PlanRepository.Entry entry:repository.load()) if(entry.date.equals(day.toString())) {
                count++;
                LinearLayout card=new LinearLayout(this);card.setOrientation(LinearLayout.VERTICAL);card.setPadding(dp(12),dp(8),dp(12),dp(12));card.setBackgroundColor(Color.WHITE);
                CheckBox done=new CheckBox(this);done.setText(getString(R.string.plan_entry,entry.time.isEmpty()?"":entry.time+" · ",entry.title));done.setTextSize(17);done.setTextColor(Color.rgb(22,28,42));done.setMinHeight(dp(48));done.setChecked(entry.done);
                done.setOnCheckedChangeListener((button,checked)->replace(entry,new PlanRepository.Entry(entry.id,entry.date,entry.time,entry.title,entry.note,checked)));
                card.addView(done);if(!entry.note.isEmpty())card.addView(text(entry.note,15));card.addView(button("Изменить",()->edit(entry)));
                LinearLayout.LayoutParams layout=new LinearLayout.LayoutParams(-1,-2);layout.bottomMargin=dp(12);list.addView(card,layout);
            }
            if(count==0){TextView empty=text("На этот день записей нет",18);empty.setPadding(0,dp(28),0,dp(28));list.addView(empty);}
        } catch(IOException error){list.addView(text("Не удалось прочитать план. Данные не перезаписаны. Попробуйте открыть приложение снова или очистите план через «Ещё».",16));}
    }
    private void edit(PlanRepository.Entry original) {
        LinearLayout form=new LinearLayout(this);form.setOrientation(LinearLayout.VERTICAL);form.setPadding(dp(20),dp(8),dp(20),0);
        EditText title=field(form,"Занятие или дело",160,false),time=field(form,"Время, например 08:30 (необязательно)",5,false),note=field(form,"Аудитория, материалы или заметка",1000,true);
        title.setText(original==null?"":original.title);time.setText(original==null?"":original.time);note.setText(original==null?"":original.note);
        TextView date=text((original==null?day:LocalDate.parse(original.date)).format(dateFormat),14);form.addView(date,0);
        ScrollView editorScroll=new ScrollView(this);editorScroll.addView(form);
        AlertDialog dialog=new AlertDialog.Builder(this).setTitle(original==null?"Новая запись":"Изменить запись").setView(editorScroll).setPositiveButton("Сохранить",null).setNegativeButton("Отмена",null).create();
        dialog.setOnShowListener(ignored->dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(view->{
            if(title.getText().toString().trim().isEmpty()){title.setError("Укажите название");return;}
            try {
                String value=time.getText().toString().trim();
                if(!value.isEmpty()&&!value.matches("(?:[01][0-9]|2[0-3]):[0-5][0-9]")){time.setError("Введите время в формате 08:30");return;}
                List<PlanRepository.Entry> entries=repository.load();
                if(original==null&&entries.size()>=PlanRepository.LIMIT){toast("Можно сохранить до 200 записей");return;}
                PlanRepository.Entry entry=new PlanRepository.Entry(original==null?UUID.randomUUID().toString():original.id,original==null?day.toString():original.date,value,title.getText().toString(),note.getText().toString(),original!=null&&original.done);
                entries.removeIf(item->item.id.equals(entry.id));entries.add(entry);repository.save(entries);dialog.dismiss();render();
            } catch(IOException|IllegalArgumentException error){toast("Не удалось сохранить запись. Предыдущий план сохранён.");}
        }));
        dialog.show();
        if(original!=null){Button delete=button("Удалить запись",()->new AlertDialog.Builder(this).setMessage("Удалить эту запись с устройства?").setNegativeButton("Отмена",null).setPositiveButton("Удалить",(d,w)->{if(replace(original,null))dialog.dismiss();}).show());form.addView(delete);}
    }
    private boolean replace(PlanRepository.Entry old,PlanRepository.Entry next) {
        try {List<PlanRepository.Entry> entries=repository.load();entries.removeIf(item->item.id.equals(old.id));if(next!=null)entries.add(next);repository.save(entries);render();return true;}
        catch(IOException error){toast("Не удалось сохранить план");render();return false;}
    }
    private void more() {
        new AlertDialog.Builder(this).setItems(new String[]{"Поделиться планом на день","Удалить весь локальный план"},(dialog,choice)->{
            if(choice==1){new AlertDialog.Builder(this).setMessage("Удалить все записи на этом устройстве? Это действие нельзя отменить. Аккаунт и данные на сайте не изменятся.").setNegativeButton("Отмена",null).setPositiveButton("Удалить всё",(d,w)->{try{repository.clear();render();}catch(IOException error){toast("Не удалось очистить план");}}).show();return;}
            try {StringBuilder content=new StringBuilder("НаПаре · "+day.format(dateFormat)+"\n");int count=0;for(PlanRepository.Entry e:repository.load())if(e.date.equals(day.toString())){count++;content.append(e.done?"✓ ":"• ").append(e.time).append(" ").append(e.title).append("\n");if(!e.note.isEmpty())content.append(e.note).append("\n");}if(count==0){toast("На этот день записей нет");return;}Intent intent=new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT,content.toString());startActivity(Intent.createChooser(intent,"Поделиться планом"));}
            catch(IOException|android.content.ActivityNotFoundException error){toast("Не удалось поделиться планом");}
        }).show();
    }
    private EditText field(LinearLayout parent,String label,int limit,boolean multiline){parent.addView(text(label,14));EditText field=new EditText(this);field.setContentDescription(label);field.setSingleLine(!multiline);field.setInputType(InputType.TYPE_CLASS_TEXT|(multiline?InputType.TYPE_TEXT_FLAG_MULTI_LINE:InputType.TYPE_TEXT_FLAG_CAP_SENTENCES));field.setFilters(new InputFilter[]{new InputFilter.LengthFilter(limit)});field.setMinHeight(dp(48));parent.addView(field);return field;}
    private LinearLayout row(){LinearLayout result=new LinearLayout(this);result.setGravity(Gravity.CENTER_VERTICAL);result.setPadding(dp(8),dp(4),dp(8),dp(4));return result;}
    private TextView text(String value,int size){TextView result=new TextView(this);result.setText(value);result.setTextSize(size);result.setTextColor(Color.rgb(34,42,60));return result;}
    private Button button(String label,Runnable action){Button result=new Button(this);result.setText(label);result.setAllCaps(false);result.setMinHeight(dp(48));result.setOnClickListener(view->action.run());return result;}
    private int dp(int value){return Math.round(value*getResources().getDisplayMetrics().density);}
    private void toast(String value){Toast.makeText(this,value,Toast.LENGTH_LONG).show();}
}
